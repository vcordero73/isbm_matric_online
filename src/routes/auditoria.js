const express = require('express');
const router = express.Router();
const pool = require('../database');
const { isLoggedIn } = require('../lib/auth');
const { isNotLoggedIn } = require('../lib/auth');
const path = require('path');

const { database } = require('../keys');
const util = require( 'util' );
const mysql = require( 'mysql' );
const { Http2ServerRequest } = require('http2');
const nodemailer = require('nodemailer');

const origen = path.join(__dirname, '../public/uploads/pagos')

function makeDb( config ) {
  const connection = mysql.createConnection( config );
  return {
    query( sql, args ) {
      return util.promisify( connection.query )
        .call( connection, sql, args );
    },
    close() {
      return util.promisify( connection.end ).call( connection );
    },
    beginTransaction() {
        return util.promisify( connection.beginTransaction )
          .call( connection );
      },
    commit() {
        return util.promisify( connection.commit )
          .call( connection );
      },
    rollback() {
        return util.promisify( connection.rollback )
          .call( connection );
      }
  };
};

router.get('/audit',  isLoggedIn, async (req, res) => {
  const ciclo = await pool.query('select ciclo_lectivo from ciclo_inscrip limit 1');
  var ciclo_lectivo = ciclo[0].ciclo_lectivo;
  var nivel = req.user.nivel;
  var nivel_ense = '';
  if (nivel === 'T')
  {
    nivel = 'S';
    nivel_ense = 'SECUNDARIA';
  }

  if(nivel =='I')
  {
    nivel_ense = 'INICIAL';
    console.log('nivel del usuario = ', nivel);
    const inscripcion = await pool.query('select i.id_inscripcion, case when i.inscripto=\'S\' then \'INSCRIPTO\' when i.inscripto=\'N\' and i.auditado=\'N\' then \'NO AUDIT\' else \'AUDIT/RECHAZADO\' end as estado, fr_s1_sala sala, fr_s1_seccion seccion, fr_s1_turno turno,a.fr_s1_documento documento_alu, concat_ws(\',\',fr_s1_apellido,fr_s1_nombre) apynom_alu, i.url_pago, i.ext_pago , t.fr_s3_email_tutor email_tutor from inscripciones i inner join ciclo_inscrip c on i.id_ciclo=c.id_cilco inner join nivel_educacion n on i.id_nivel = n.id_nivel inner join fr_s1_alumno a on a.id_inscripcion=i.id_inscripcion inner join fr_s3_tutor t on i.id_inscripcion = t.id_inscripcion where n.cod_nivel= ? ',[nivel]);
    console.log('registro = ', inscripcion);
    res.render('auditoria/audit_inicial',{ciclo_lectivo, nivel_ense, inscripcion});
  }
  else if (nivel === 'P') {
    nivel_ense = 'PRIMARIA';
    console.log('nivel del usuario = ', nivel);
    const inscripcion = await pool.query('select i.id_inscripcion, case when i.inscripto=\'S\' then \'INSCRIPTO\' when i.inscripto=\'N\' and i.auditado=\'N\' then \'NO AUDIT\' else \'AUDIT/RECHAZADO\' end as estado, fr_s1_grado grado, fr_s1_seccion seccion, fr_s1_turno turno,a.fr_s1_documento documento_alu, concat_ws(\',\',fr_s1_apellido,fr_s1_nombre) apynom_alu, i.url_pago, i.ext_pago , t.fr_s3_email_tutor email_tutor from inscripciones i inner join ciclo_inscrip c on i.id_ciclo=c.id_cilco inner join nivel_educacion n on i.id_nivel = n.id_nivel inner join fr_s1_alumno a on a.id_inscripcion=i.id_inscripcion inner join fr_s3_tutor t on i.id_inscripcion = t.id_inscripcion where n.cod_nivel= ? ',[nivel]);
    console.log('registro = ', inscripcion);
    res.render('auditoria/audit_primaria',{ciclo_lectivo, nivel_ense, inscripcion});
  } else {
    nivel_ense = 'SECUNDARIA';
    console.log('nivel del usuario = ', nivel);
    const inscripcion = await pool.query('select i.id_inscripcion, case when i.inscripto=\'S\' then \'INSCRIPTO\' when i.inscripto=\'N\' and i.auditado=\'N\' then \'NO AUDIT\' else \'AUDIT/RECHAZADO\' end as estado, fr_s1_orientacion_sec orientacion, fr_s1_anio_sec anio, fr_s1_division_sec division,fr_s1_turno turno, a.fr_s1_documento documento_alu, concat_ws(\',\',fr_s1_apellido,fr_s1_nombre) apynom_alu, i.url_pago, i.ext_pago, t.fr_s3_email_tutor email_tutor  from inscripciones i inner join ciclo_inscrip c on i.id_ciclo=c.id_cilco inner join nivel_educacion n on i.id_nivel = n.id_nivel inner join fr_s1_alumno a on a.id_inscripcion=i.id_inscripcion inner join fr_s3_tutor t on i.id_inscripcion = t.id_inscripcion where n.cod_nivel= ? ',[nivel]);
    console.log('registro = ', inscripcion);
    console.log('origen = ', origen);
    res.render('auditoria/audit_secundaria',{ciclo_lectivo, nivel_ense,inscripcion, origen});
  }
    
  });

  

  router.get('/ingreso', isNotLoggedIn, async (req, res) => {
    res.redirect('/signin');
  });

  router.get('/registro', isNotLoggedIn, async (req, res) => {
    res.redirect('/signup');
  });


  router.get('/edit/:id', async (req, res) => {
    const { id } = req.params;
    const nivel = req.user.nivel;
    console.log('entro en edit modal valor id =  ', id);
    console.log('nivel  =  ', nivel);
    var nivel_inscrip = '';
   if (nivel === 'T')
   {
    nivel_inscrip = 'S';
    
   }else{
    nivel_inscrip = nivel;
   }
     console.log('nivel inscrip =  ', nivel_inscrip);

    const alumno = await pool.query('select * from fr_s1_alumno where id_inscripcion= ? limit 1', [id]);
    const padres = await pool.query('select * from fr_s2_padres where id_inscripcion= ? limit 1', [id]);
    const grupofam = await pool.query('select * from fr_s2_grupofamiliar where id_inscripcion= ? order by id_frs2grupofam asc', [id]);
    const antemedico = await pool.query('select * from fr_s4_antec_medico_alu where id_inscripcion= ? limit 1', [id]);
    const tutor = await pool.query('select * from fr_s3_tutor where id_inscripcion= ? limit 1', [id]);
    const autorizretiro = await pool.query('select * from fr_s5_autorizazion where id_inscripcion= ? order by id_frs5autorizacion asc', [id]);
  
    if (nivel_inscrip === 'I') {
      console.log('entro en edit modal inicial  ');
      res.render('auditoria/edit_i', {id, alumno,padres, grupofam, antemedico,tutor,autorizretiro});   
    } else if (nivel_inscrip === 'P') {
      console.log('entro en edit modal primaria  ');
      res.render('auditoria/edit_p', {id, alumno,padres, grupofam, antemedico,tutor,autorizretiro});   
    } else if (nivel_inscrip === 'S') {
      console.log('entro en edit modal secundaria');
      res.render('auditoria/edit_s', {id, alumno,padres, grupofam, antemedico,tutor,autorizretiro});   
    }
    else{
      res.send('valor de nivel inscrip no reconocido');
    }
  
  });



  router.post('/audit_edit_secundaria', async (req, res) => {
    const datos = req.body; 
    const id  = datos.id_inscripcion;
    const id_inscripcion= id;

    const db = makeDb( database );
  
    console.log('entro en audit_edit_secundaria ');
    console.log('valor de datos ');
    console.log(datos);
    
    var id_frs2padres=0;
    var id_transac=0;
  
    try {
      await db.beginTransaction();
    
          console.log('id inscripcion a procesar = ', id);
          // consulto primero si el alumno existe
          const bdalu = await db.query('select id_frs1alumno from fr_s1_alumno where id_inscripcion= ? LIMIT 1', [id]);
        
          if (bdalu.length > 0) {
            console.log('Alumno existe actualizando ');
            var alumno ={
              id_inscripcion,
              fr_s1_apellido: datos.fr_s1_apellido,
              fr_s1_nombre  : datos.fr_s1_nombre,
              fr_s1_sexo    : datos.fr_s1_sexo,
              fr_s1_orientacion_sec   : datos.fr_s1_orientacion_sec,
              fr_s1_anio_sec : datos.fr_s1_anio_sec,
              fr_s1_division_sec : datos.fr_s1_division_sec,
              fr_s1_turno   : datos.fr_s1_turno,
              fr_s1_tipo_doc : datos.fr_s1_tipo_doc,
              fr_s1_documento : datos.fr_s1_documento,
              fr_s1_nacionalidad : datos.fr_s1_nacionalidad,
              fr_s1_cuil         : datos.fr_s1_cuil,
              fr_s1_nacido_en    : datos.fr_s1_nacido_en,
              fr_s1_provincia    : datos.fr_s1_provincia,
              fr_s1_dia_nac      : datos.fr_s1_dia_nac,
              fr_s1_mes_nac      : datos.fr_s1_mes_nac,
              fr_s1_anio_nac     : datos.fr_s1_anio_nac,
              fr_s1_domi_calle   : datos.fr_s1_domi_calle,
              fr_s1_domi_nro     : datos.fr_s1_domi_nro,
              fr_s1_domi_barrio  : datos.fr_s1_domi_barrio,
              fr_s1_telef_fijo   : datos.fr_s1_telef_fijo,
              fr_s1_telef_celu   : datos.fr_s1_telef_celu,
              fr_s1_telef_contacto : datos.fr_s1_telef_contacto,
              fr_s1_bauti_dia      : datos.fr_s1_bauti_dia,
              fr_s1_bauti_mes      : datos.fr_s1_bauti_mes,
              fr_s1_bauti_anio     : datos.fr_s1_bauti_anio,
              fr_s1_bauti_parroquia : datos.fr_s1_bauti_parroquia,
              fr_s1_comu_dia        : datos.fr_s1_comu_dia,
              fr_s1_comu_mes        : datos.fr_s1_comu_mes,
              fr_s1_comu_anio       : datos.fr_s1_comu_anio,
              fr_s1_comu_parroquia  : datos.fr_s1_comu_parroquia,
              fr_s1_inst_proviene   : datos.fr_s1_inst_proviene,
              fr_s1_observ          : datos.fr_s1_observ,
              fr_s1_correo_educa    : datos.fr_s1_correo_educa,
              fr_s1_medio_conect : datos.fr_s1_medio_conect,
              fr_s1_equipo_conect_celu : datos.fr_s1_equipo_conect_celu,
              fr_s1_equipo_conect_pc  : datos.fr_s1_equipo_conect_pc,
              fr_s1_equipo_conect_noteb : datos.fr_s1_equipo_conect_noteb,
              fr_s1_detalle_otro        : datos.fr_s1_detalle_otro,
              fr_s1_acceso_internet     : datos.fr_s1_acceso_internet,
              fr_s1_celular_alum        : datos.fr_s1_celular_alum,
              fr_s1_mediotras_caminando : datos.fr_s1_mediotras_caminando,
              fr_s1_mediotras_medioprop : datos.fr_s1_mediotras_medioprop,
              fr_s1_mediotras_transp    : datos.fr_s1_mediotras_transp
            };
              
            console.log('id_frs1lumno a procesar = ', bdalu[0].id_frs1alumno);
            console.log('datos del alumno = ', alumno);
        
            await db.query('UPDATE fr_s1_alumno set ? WHERE id_frs1alumno =?', [alumno, bdalu[0].id_frs1alumno]);
        
          }
          else{
            console.log('Alumno NO existe lo carga ');
            console.log('datos del alumno = ', alumno);
            await db.query('INSERT INTO fr_s1_alumno set ?', [alumno]);
        }
  
      //Actualiza padres
      console.log('procesando padres');
      // consulto primero si registro de padre existe
      const bdpadres = await db.query('select id_frs2padres from fr_s2_padres where id_inscripcion= ? LIMIT 1', [id]);
      var padres ={
        id_inscripcion: id,
        fr_s1_documento : datos.fr_s1_documento,
        fr_s2_apellido_padre : datos.fr_s2_apellido_padre,
        fr_s2_nombre_padre : datos.fr_s2_nombre_padre,
        fr_s2_nacionalidad_padre : datos.fr_s2_nacionalidad_padre,
        fr_s2_tipo_doc_padre : datos.fr_s2_tipo_doc_padre,
        fr_s2_documento_padre : datos.fr_s2_documento_padre,
        fr_s2_domicilio_padre : datos.fr_s2_domicilio_padre,
        fr_s2_localidad_padre : datos.fr_s2_localidad_padre,
        fr_s2_provincia_padre : datos.fr_s2_provincia_padre,
        fr_s2_profesion_padre : datos.fr_s2_profesion_padre,
        fr_s2_celular_padre : datos.fr_s2_celular_padre,
        fr_s2_telef_contacto_padre : datos.fr_s2_telef_contacto_padre,
        fr_s2_telef_lab_padre : datos.fr_s2_telef_lab_padre,
        fr_s2_email_padre : datos.fr_s2_email_padre,
        fr_s2_vive_padre : datos.fr_s2_vive_padre,
        fr_s2_apellido_madre : datos.fr_s2_apellido_madre,
        fr_s2_nombre_madre : datos.fr_s2_nombre_madre,
        fr_s2_nacionalidad_madre : datos.fr_s2_nacionalidad_madre,
        fr_s2_tipo_doc_madre : datos.fr_s2_tipo_doc_madre,
        fr_s2_documento_madre : datos.fr_s2_documento_madre,
        fr_s2_domicilio_madre : datos.fr_s2_domicilio_madre,
        fr_s2_localidad_madre : datos.fr_s2_localidad_madre,
        fr_s2_provincia_madre : datos.fr_s2_provincia_madre,
        fr_s2_profesion_madre : datos.fr_s2_profesion_madre,
        fr_s2_celular_madre : datos.fr_s2_celular_madre,
        fr_s2_telef_contacto_madre : datos.fr_s2_telef_contacto_madre,
        fr_s2_telef_lab_madre : datos.fr_s2_telef_lab_madre,
        fr_s2_email_madre : datos.fr_s2_email_madre,
        fr_s2_vive_madre : datos.fr_s2_vive_madre,
        fr_s2_religion_profesan : datos.fr_s2_religion_profesan,
        fr_s2_matrimonio_iglesia : datos.fr_s2_matrimonio_iglesia
       }
  
      if (bdpadres.length > 0) {
        console.log('Registro de Padres existe actualizando ');
        id_frs2padres=bdpadres[0].id_frs2padres;
       
        console.log('id_frs2padres = ', id_frs2padres);
        console.log('detos de los padres= ',padres);
  
        await db.query('UPDATE fr_s2_padres set ? WHERE id_frs2padres=?',  [padres, id_frs2padres]);
         
      }
      else{
          // no existe inserta
          console.log('Registro de Padres NO existe INSERTANDO ');
          console.log('detos de los padres= ',padres);
          await db.query('INSERT INTO fr_s2_padres  set ?',  [padres, id_frs2padres]);
      }
  
       //Actualiza grupo familiar
       console.log('GRUPO FAMILIAR ');
       //Borra primero todo el grupo familiar cargado
       await db.query('DELETE FROM fr_s2_grupofamiliar WHERE id_inscripcion= ?',[id]); 
       
         console.log('GRUPO FAMILIAR - BORRADO AHORA INSERTA');
          var frs2_apynom_fam = datos.fr_s2_apynom_fam;
          var frs2_parentesco = datos.fr_s2_parentesco;
          var frs2_edad  = datos.fr_s2_edad;
          var frs2_grupo_riesgo = datos.fr_s2_grupo_riesgo;
          console.log('grupo fam - fr_s2_apynom ', frs2_apynom_fam);
          if (typeof(frs2_apynom_fam) != "undefined")
          {
            if (frs2_apynom_fam.length > 1)
            {
                  
                  // Hay grupo familiar procede a cargar
                  for (var i=1; i<frs2_apynom_fam.length; i++) 
                  { 
                    
                    var grupofarm = {
                      fr_s1_documento : datos.fr_s1_documento,
                      id_frs2padres,
                      id_inscripcion : id,
                      fr_s2_apynom_fam : frs2_apynom_fam[i],
                      fr_s2_parentesco : frs2_parentesco[i],
                      fr_s2_edad       : frs2_edad[i],
                      fr_s2_grupo_riesgo : frs2_grupo_riesgo[i]
                    };
                    console.log('GRUPO FAMILIAR REGISTRO A INSERTAR = ', grupofarm);
                     await db.query('INSERT INTO fr_s2_grupofamiliar set ?', [grupofarm]);
                  }
               
             }
          }
          
          
       //Actualiza Tutor
       console.log('Tutor consultando ');
       const bdtutor = await db.query('select id_frs3tutor from fr_s3_tutor where id_inscripcion=? LIMIT 1', [id]);
  
        if (bdtutor.length > 0) {
          console.log('Tutor existe actualizando ');
          var tutor = {
            fr_s1_documento : datos.fr_s1_documento,
            id_inscripcion : id,
            fr_s3_apellido_tutor : datos.fr_s3_apellido_tutor,
            fr_s3_nombre_tutor   : datos.fr_s3_nombre_tutor,
            fr_s3_domicilio_tutor : datos.fr_s3_domicilio_tutor,
            fr_s3_nacionalidad_tutor : datos.fr_s3_nacionalidad_tutor,
            fr_s3_tipo_doc_tutor  : datos.fr_s3_tipo_doc_tutor,
            fr_s3_documento_tutor : datos.fr_s3_documento_tutor,
            fr_s3_profesion_tutor : datos.fr_s3_profesion_tutor,
            fr_s3_lugartrabajo_tutor : datos.fr_s3_lugartrabajo_tutor,
            fr_s3_celular_tutor   : datos.fr_s3_celular_tutor,
            fr_s3_telef_fijo_tutor : datos.fr_s3_telef_fijo_tutor,
            fr_s3_telef_lab_tutor  : datos.fr_s3_telef_lab_tutor,
            fr_s3_horario_contacto_tutor : datos.fr_s3_horario_contacto_tutor,
            fr_s3_parentesco_tutor : datos.fr_s3_parentesco_tutor,
            fr_s3_tipo_parentesco_tutor : datos.fr_s3_tipo_parentesco_tutor,
            fr_s3_acredit_parent_tutor : datos.fr_s3_acredit_parent_tutor,
            fr_s3_email_tutor : datos.fr_s3_email_tutor
          }
          
          console.log('Tutor datos = ', tutor);
  
          await db.query('UPDATE fr_s3_tutor set ? WHERE id_frs3tutor=?',  [tutor, bdtutor[0].id_frs3tutor] );
        }
        else{
            console.log('Tutor NO existe se carga ');
            console.log('Tutor datos = ', tutor);
           await db.query('INSERT INTO fr_s3_tutor set ?', [tutor] );
        }
        
       //Actualiza Antecedentes Medicos
       const bdantemed = await  db.query('select id_frs4antecmedicoalu from fr_s4_antec_medico_alu where id_inscripcion= ? LIMIT 1', [id]);
       var antec_emedico = {
        id_inscripcion,
        fr_s1_documento : datos.fr_s1_documento,
        fr_s4_grupo_riesgo_1 : datos.fr_s4_grupo_riesgo_1,
        fr_s4_grupo_riesgo_2 : datos.fr_s4_grupo_riesgo_2,
        fr_s4_grupo_riesgo_3 : datos.fr_s4_grupo_riesgo_3,
        fr_s4_grupo_riesgo_4 : datos.fr_s4_grupo_riesgo_4
        };
        
        if (bdantemed.length > 0) {
          console.log('Antecedentes medicos existe procede actualizar ');
          console.log('Antecedentes medicos datos = ', antec_emedico);
          await db.query('UPDATE fr_s4_antec_medico_alu set ? WHERE id_frs4antecmedicoalu=?',  [antec_emedico, bdantemed[0].id_frs4antecmedicoalu]);
        }
        else{
          //No hay registros de antecedente medicos pero si hay en la edicion, procede a cargar
          console.log('Antecedentes medicos NO existe procede actualizar ');
          console.log('Antecedentes medicos datos = ', antec_emedico);
          await db.query('INSERT INTO fr_s4_antec_medico_alu set ?', [antec_emedico]);
        }
  
  
       //Actualiza Autorizacion
       console.log('Borrando autorizaciones de retiro ');
         
       await db.query('DELETE FROM fr_s5_autorizazion WHERE id_inscripcion= ?',[id]);
              //Procede a cargar las nuevas autorizaciones
                var frs5_apynom_autoriz = datos.fr_s5_apynom_autoriz;
                var frs5_dni_autoriz = datos.fr_s5_dni_autoriz;
                var frs5_parentesco_autoriz  = datos.fr_s5_parentesco_autoriz;
                var frs5_telef_autoriz = datos.fr_s5_telef_autoriz;
                console.log('grupo fam  autoriz - frs5_apynom_autoriz ', frs5_apynom_autoriz);
                console.log('grupo fam  autoriz - typeof ',typeof(frs5_apynom_autoriz));
                if (typeof(frs5_apynom_autoriz) != "undefined")
                {
                  if (frs5_apynom_autoriz.length > 1)
                  {
                      var aux2=0;
                      // Hay autorizaciones procede a cargar
                      for (var i=1; i<frs5_apynom_autoriz.length; i++) 
                      { 
                      
                        var grupoautoriz = {
                          fr_s1_documento : datos.fr_s1_documento,
                          id_inscripcion,
                          fr_s5_apynom_autoriz : frs5_apynom_autoriz[i],
                          fr_s5_dni_autoriz : frs5_dni_autoriz[i],
                          fr_s5_parentesco_autoriz       : frs5_parentesco_autoriz[i],
                          fr_s5_telef_autoriz : frs5_telef_autoriz[i]
                          };
    
                          console.log('grupo fam  autoriz - registro= ', grupoautoriz);
                          aux2++;
                          await db.query('INSERT INTO fr_s5_autorizazion set ?', [grupoautoriz]);
                      }
                    }
  
                }
                
  
      // Actualiza el registro de inscripcion para que sea considerado como un registro nuevo
    await db.query('UPDATE inscripciones set inscripto=?, form_cargado=?, auditado=?, autorizado=? WHERE id_inscripcion=?',  ['N','S','N','N', id] );
  
  
      // do something with someRows and otherRows
      await db.commit();
      console.log('Comit de transaccion');
      id_transac=1;
    } catch ( err ) {
      console.log('Entro en error de transaccion');
      console.log(err);
      await db.rollback();
      // handle the error
    } finally {
      console.log('Entro cerrar transaccion');
      await db.close();
    }
   if(id_transac === 1)
   {
    res.redirect('/audit_edit_ok');
   }
   else{
    res.redirect('/audit_edit_error');
   }
    
     
  });
  
  router.get('/audit_edit_ok', isLoggedIn, async (req, res) => {
    res.render('auditoria/audit_edit_ok');
  });

  router.get('/audit_edit_error', isLoggedIn, async (req, res) => {
    res.render('auditoria/audit_edit_error');
  });

 
  router.get('/ver_imagen', isLoggedIn, async (req, res) => {
    const imagen = req.query.imagen;
    console.log(imagen);
    res.render('auditoria/visualizar_img',{imagen} ) ;
  
  });

  router.get('/audit_email', isLoggedIn, async (req, res) => {
    const email_tutor = req.query.email;
    console.log(email_tutor);
    res.render('auditoria/audit_email',{email_tutor}) ;
  
  });

  router.post('/audit_email', isLoggedIn, async (req, res) => {
    const { recipient_name,message_text } = req.body;
    const nivel = req.user.nivel;
    console.log(recipient_name);
    console.log(message_text);
    
    var user_email=' ';
    var pass_email=' ';
    
    console.log('nivel leido =  ', nivel);

    if (nivel === 'I') {
      console.log('entro en email inicial  ');
      user_email='administracion_ni@isbm.edu.ar';
      pass_email='Niveli#2020';
     
    } else if (nivel === 'P') {
      console.log('entro en email primaria  ');
      user_email='administracion_np@isbm.edu.ar';
      pass_email='IDZG@Qc8iF';
      
    } else if (nivel === 'S') {
      console.log('entro en email secundaria  '); 
      user_email='administracion_ns@isbm.edu.ar';
      pass_email='isbms2020';
     
    }
    console.log('valor de usuario email = ',user_email);
    console.log('valor de pass email = ',pass_email);

    
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: user_email,
        pass: pass_email
      }
    });

  // verify connection configuration
transporter.verify(function(error, success) {
  if (error) {
      console.log('Error al verificar correo');
       console.log(error);
  } else {
       console.log('Server is ready to take our messages');
  }
});
console.log('antes de enviar correo');
console.log('valor de to email = ',recipient_name);


     // setup e-mail data with unicode symbols
     var mailOptions = { };
    
if (nivel === 'I') {
  mailOptions = {
    from: '"ISBM - Secretaria Nivel Inicial" <administracion_ni@isbm.edu.ar>',
    to: recipient_name,
    subject: 'Contacto por Matriculación Online',
    text: message_text
    //html: '<b>Hello world ?</b>' // html body
  };
}
else if (nivel === 'P') {
  mailOptions = {
    from: '"ISBM - Secretaria Nivel Primario" <administracion_np@isbm.edu.ar>',
    to: recipient_name,
    subject: 'Contacto por Matriculación Online',
    text: message_text
    //html: '<b>Hello world ?</b>' // html body
  };
}
else{
  mailOptions = {
    from: '"ISBM - Secretaria Nivel Secundario\" <administracion_ns@isbm.edu.ar>',
    to: recipient_name,
    subject: 'Contacto por Matriculación Online',
    text: message_text
    //html: '<b>Hello world ?</b>' // html body
  };

}
  console.log('options = ', mailOptions);
// send mail with defined transport object
transporter.sendMail(mailOptions, function(error, info){
  if(error){
      console.log(error);
      res.render('auditoria/audit_email_error');
  }
  console.log('mensaje respuesta = ', info.messageId);
  res.render('auditoria/audit_email_ok');
});

});




router.get('/audit_autoriz', isLoggedIn, async (req, res) => {
    const id_inscrip = req.query.id;
    const  recipient_name  = req.query.email;
    const  dni_alumno  = req.query.dni;
    const nivel = req.user.nivel;
    console.log('entro en audit_autoriz con id =', id_inscrip);
    console.log('entro en audit_autoriz con email tutor =', recipient_name);
    console.log('entro en audit_autoriz con nivel =', nivel);

    var nivel_ense='';
    
       //primero actualiza la base 
      // Actualiza el registro de inscripcion para indicar que fue autorizado e inscripto
           
      await pool.query('UPDATE inscripciones set inscripto=?,  auditado=?, autorizado=? WHERE id_inscripcion=?',  ['S','S','S', id_inscrip], function (err, result) {
          if (err) throw err;
          console.log(result.affectedRows + " record(s) updated");
          if(result.affectedRows>0)
          {
              //Segundo : Envio correo de que esta autorizado
              
                    
                    
                    console.log(recipient_name);
                                    
                    var user_email=' ';
                    var pass_email=' ';
                    
                    
                    if (nivel === 'I') {
                      console.log('entro en email inicial  ');
                      user_email='administracion_ni@isbm.edu.ar';
                      pass_email='Niveli#2020';
                      nivel_ense='INICIAL';
                    } else if (nivel === 'P') {
                      console.log('entro en email primaria  ');
                      user_email='administracion_np@isbm.edu.ar';
                      pass_email='IDZG@Qc8iF';
                      nivel_ense='PRIMARIO';
                      
                    } else if (nivel === 'S') {
                      console.log('entro en email secundaria  '); 
                      user_email='administracion_ns@isbm.edu.ar';
                      pass_email='isbms2020';
                      nivel_ense='SECUNDARIO';
                    }
                    console.log('valor de usuario email = ',user_email);
                    console.log('valor de pass email = ',pass_email);
                    console.log('valor de nivel ense = ',nivel_ense);
                     
                    const mensaje_html= `
                    <h1 class="font-weight-bold"> Notificación del Instituo San Basilio Magno </h1>
                    <p> <span class="font-weight-bold"> Correo electrónico del Tutor:</span> ${recipient_name} </p> 
                    <p> <span class="font-weight-bold"> DNI del Alumno/a: </span> ${dni_alumno} </p>
                    <br> <h2 class="font-weight-bold"> La Secretaría del Nivel ${nivel_ense} informa </h2>
                    <p> La solicitud de matriculación ha sido Autorizada  </p>
                    <p class="font-italic">Para cerrar el proceso de matriculación online dispone de dos(2) opicones :  </p>
                    <p class="font-italic"> 1) Imprimir matricula y presentar en el colegio. Ingrese al sistema de matriculación online con los mismos datos: DNI alumno/a y Tutor; Nivel de Enseñanza. Luego imprima y firme el formulario; y luego llevar y dejar dentro del buzón de la Institución destinado para las matrículas online autorizadas </p>
                    <p class="font-italic"> 2) El colegio imprimirá las fichas de matriculas aprobadas. En otra oportunidad solicitará la firma al tutor </p>
                    `;
                    
                    console.log(mensaje_html);

                    const transporter = nodemailer.createTransport({
                      host: 'smtp.gmail.com',
                      port: 465,
                      secure: true,
                      auth: {
                        user: user_email,
                        pass: pass_email
                      }
                    });

                  // verify connection configuration
                    transporter.verify(function(error, success) {
                      if (error) {
                          console.log('Error al verificar correo');
                          console.log(error);
                      } else {
                          console.log('Server is ready to take our messages');
                      }
                    });
                    console.log('antes de enviar correo');
                    console.log('valor de to email = ',recipient_name);


                    // setup e-mail data with unicode symbols
                    var mailOptions = { };
                    
                    if (nivel === 'I') {
                      mailOptions = {
                        from: '"ISBM - Secretaria Nivel Inicial" <administracion_ni@isbm.edu.ar>',
                        to: recipient_name,
                        subject: 'Contacto por Matriculación Online',
                        //text: message_text
                        html: mensaje_html // html body
                      };
                    }
                    else if (nivel === 'P') {
                      mailOptions = {
                        from: '"ISBM - Secretaria Nivel Primario" <administracion_np@isbm.edu.ar>',
                        to: recipient_name,
                        subject: 'Contacto por Matriculación Online',
                        //text: message_text
                        html: mensaje_html // html body
                      };
                    }
                    else{
                      mailOptions = {
                        from: '"ISBM - Secretaria Nivel Secundario\" <administracion_ns@isbm.edu.ar>',
                        to: recipient_name,
                        subject: 'Contacto por Matriculación Online',
                        //text: message_text
                        html: mensaje_html // html body
                      };

                    }
                    console.log('options = ', mailOptions);
                    // send mail with defined transport object
                    transporter.sendMail(mailOptions, function(error, info){
                      if(error){
                          console.log(error);
                          res.render('auditoria/audit_inscrip_error');
                      }
                      console.log('mensaje respuesta = ', info.messageId);
                      res.render('auditoria/audit_inscrip_ok');
                    });
               
               
          }
      });
  
  });

  
  


module.exports = router;