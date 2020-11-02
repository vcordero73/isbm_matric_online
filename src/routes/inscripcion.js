const express = require('express');
const { body, validationResult, check } = require('express-validator');
const router = express.Router();
const pool = require('../database');
const { database } = require('../keys');
const util = require( 'util' );
const mysql = require( 'mysql' );

const path = require('path');
const multer = require('multer');
const fs = require('fs');


var documento_inscrip =0;
var documento_tutor_inscrip =0;
var nivel_inscrip=' ';
var ciclo_inscrip=0;
var id_inscripcion = 0;


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

router.get('/', async (req, res) => {
  const ciclo_lectivo = await pool.query('select ciclo_lectivo from ciclo_inscrip');
    console.log('entro en / inscripcion  ');
    res.render('inscripcion/inicio', {ciclo_lectivo});
});


router.post('/',[
    check('ciclo_lectivo', 'Se debe ingresar en Ciclo Lectivo un número de año con cuatro dígitos. No se permite nulo').notEmpty().isNumeric().isLength(4),
    check('documento', 'Número de DNI válido es requerido, no puede ser nulo y solo números se acepta').notEmpty().isNumeric().isLength(8),
    check('documento_tutor', 'Número de DNI válido es requerido, no puede ser nulo y solo números se acepta').notEmpty().isNumeric().isLength(7),
    check('nivel', 'Debe seleccionar un nivel ').notEmpty().isIn(['I','P','S'])
    ], async (req, res, next) => {
      
      const ciclo_lectivo = req.body.ciclo_lectivo;
      const documento = req.body.documento;
      const documento_tutor = req.body.documento_tutor;
      const nivel = req.body.nivel;

     
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log(errors);
        req.flash('message', errors.errors[0].msg);
        res.redirect('/inscripcion');
      }
      else {
              //valor de nivel
              console.log('valor cilo', ciclo_lectivo);
              console.log('valor documento', documento);
              console.log('valor documento tutor', documento_tutor);
              console.log('valor nivel', nivel);

              documento_inscrip =documento;
              documento_tutor_inscrip =documento_tutor;
              nivel_inscrip=nivel;
              ciclo_inscrip=ciclo_lectivo;

              // consulto primero si tiene deuda el alumno
              const deuda = await pool.query('select * from bd_deuda_alumno where documento=? LIMIT 1', [documento]);
              if ((deuda.length > 0)&&( deuda[0].importe > 0 )) {
                console.log('Alumno con deuda');
                req.flash('message', 'El Alumno registra deuda, regularizar primero y luego  iniciar la solicitud de matriculación online');
                res.redirect('/inscripcion');
              }
              // Consulto por inscripcion
              const datos = await pool.query('select * from inscripciones i inner join ciclo_inscrip c on c.id_cilco = i.id_ciclo inner join nivel_educacion n on n.id_nivel = i.id_nivel where c.ciclo_lectivo=? and i.fr_alu_docu=? and n.cod_nivel=?  LIMIT 1', [ciclo_lectivo, documento, nivel]);
              if (datos.length > 0) {
                console.log('Encontro inscripciones');
                console.log(datos);
                id_inscripcion = datos[0].id_inscripcion;
                
                if (datos[0].inscripto === 'S') {
                  console.log('Inscripcion ok Autorizada - pasa a impresion del formulario');
                  res.redirect('/inscripcion/mensaje3');
                } else {
                  console.log('Inscripcion cargada pero no Autorizada todavia');
                  console.log(documento_inscrip);
                  console.log(id_inscripcion);
                  res.redirect('/inscripcion/mensaje2');
                }
                
              } else {
                //Verifica que exista alumno en la base de datos alumno
                const bdalu = await pool.query('select documento, apellido, nom2 as nombre, sexo, SUBSTRING(fecha_nacimiento, 9,2) dia_nac, SUBSTRING(fecha_nacimiento, 6,2) mes_nac, SUBSTRING(fecha_nacimiento, 1,4) anio_nac, domicilio, localidad, provincia, telefono, lugar_nacimiento, nacionalidad,SUBSTRING(bautismo_fecha, 9,2) dia_bauti,SUBSTRING(bautismo_fecha, 6,2) mes_bauti,SUBSTRING(bautismo_fecha, 1,4) anio_bauti, bautismo_lugar,SUBSTRING(comunion_fecha, 9,2) dia_comuni, SUBSTRING(comunion_fecha, 6,2) mes_comuni, SUBSTRING(comunion_fecha, 1,4) anio_comuni,comunion_lugar FROM bd_alumno where documento=? limit 1', [documento]);
                if (bdalu.length > 0) {
                  if (nivel === 'I') {
                    console.log('Inscripcion Nueva : NIVEL INICIAL');
                    res.redirect('/inscripcion/new_inicial');
                  } else  if (nivel === 'P'){
                    console.log('Inscripcion Nueva : NIVEL PRIMARIA');
                    res.redirect('/inscripcion/new_primaria');
                  } else {
                    console.log('Inscripcion Nueva : NIVEL SECUNDARIA');
                    res.redirect('/inscripcion/new_secundaria');
                  }
                               
                }
                else
                {
                    // Consulta por documento tutor si exite
                    const bdtutor = await pool.query('select * FROM bd_alumno where documento_tutor=? limit 1', [documento_tutor]);
                    if (bdtutor.length > 0) {
                     //req.flash('message', 'Inscripción nueva');
                       if (nivel === 'I') {
                         console.log('Inscripcion Nueva : NIVEL INICIAL');
                         res.redirect('/inscripcion/new_inicial');
                       } else  if (nivel === 'P'){
                         console.log('Inscripcion Nueva : NIVEL PRIMARIA');
                         res.redirect('/inscripcion/new_primaria');
                       } else {
                         console.log('Inscripcion Nueva : NIVEL SECUNDARIA');
                         res.redirect('/inscripcion/new_secundaria');
                       }
                    }
                    else{
                     req.flash('message', 'El Alumno y/o Tutor no se enuentra en la Base de Datos de Alumno. Si es alumno nuevo en la Institución deberá  hacer la inscripción de forma presencial presentando toda la documentación requerida. Si no es un alumno nuevo informar a la Secretaria del Nivel de Enseñanza.');
                    res.redirect('/inscripcion');
                   }
                }
                                 

                  
              }
            }
    });


    router.get('/validacion', async (req, res) => {
      const ciclo_lectivo = await pool.query('select ciclo_lectivo from ciclo_inscrip');
        console.log('entro en / inscripcion  ');
        res.render('inscripcion/inicio', {ciclo_lectivo});
    });

    router.get('/new_inicial', async (req, res) => {
      
      var ciclo_lectivo = ciclo_inscrip;
      var documento = documento_inscrip;
      var documento_tutor = documento_tutor_inscrip;

      console.log('entro en inscripcion nueva inicial - ');
      console.log('valor cilo', ciclo_lectivo);
      console.log('valor documento', documento);
      console.log('valor documento tutor', documento_tutor);

      const alumno = await pool.query('select documento, apellido, nom2 as nombre, sexo, SUBSTRING(fecha_nacimiento, 9,2) dia_nac, SUBSTRING(fecha_nacimiento, 6,2) mes_nac, SUBSTRING(fecha_nacimiento, 1,4) anio_nac, domicilio, localidad, provincia, telefono, lugar_nacimiento, nacionalidad,SUBSTRING(bautismo_fecha, 9,2) dia_bauti,SUBSTRING(bautismo_fecha, 6,2) mes_bauti,SUBSTRING(bautismo_fecha, 1,4) anio_bauti, bautismo_lugar,SUBSTRING(comunion_fecha, 9,2) dia_comuni, SUBSTRING(comunion_fecha, 6,2) mes_comuni, SUBSTRING(comunion_fecha, 1,4) anio_comuni,comunion_lugar FROM bd_alumno where documento=? limit 1', [documento]);
      const padre = await pool.query('select a.apellido apellido_padre, a.nom2 nombre_padre, a.nacionalidad nacionalidad_padre, b.documento_padre, a.domicilio domi_padre, a.localidad localidad_padre, a.provincia provincia_padre, a.profesion profesion_padre, a.telefono_particular telef_padre,  celular celular_padre, a.telefono_laboral telef_laboral_padre, a.E_MAIL email_padre from bd_padre a inner join bd_alumno b on a.documento=b.documento_padre and b.documento=? limit 1', [documento]);
      const madre = await pool.query('select a.apellido apellido_madre, a.nom2 nombre_madre, a.nacionalidad nacionalidad_madre, b.documento_madre, a.domicilio domi_madre, a.localidad localidad_madre, a.provincia provincia_madre, a.profesion profesion_madre, a.telefono_particular telef_madre,  celular celular_madre, a.telefono_laboral telef_laboral_madre, a.E_MAIL email_madre from bd_padre a inner join bd_alumno b on a.documento=b.documento_madre and b.documento=? limit 1', [documento]);
      const tutor = await pool.query('select a.apellido apellido_tutor, a.nom2 nombre_tutor, a.nacionalidad nacionalidad_tutor, a.documento documento_tutor, a.domicilio domi_tutor, a.localidad localidad_tutor, a.provincia provincia_tutor, a.profesion profesion_tutor, a.telefono_particular telef_tutor,  celular celular_tutor, a.telefono_laboral telef_laboral_tutor, a.E_MAIL email_tutor from bd_padre a where a.documento=?  limit 1', [documento_tutor]);
      
      console.log(alumno);
      var datos={
        ciclo_lectivo: ciclo_lectivo,
        alumno: alumno,
        padre: padre,
        madre: madre,
        tutor: tutor
    };
    console.log(datos);
      res.render('inscripcion/new_inicial.hbs', datos );
    });

    
    router.get('/new_primaria', async (req, res) => {
      var ciclo_lectivo = ciclo_inscrip;
      var documento = documento_inscrip;
      var documento_tutor = documento_tutor_inscrip;

      console.log('entro en inscripcion nueva primaria - ');
      console.log('valor cilo', ciclo_lectivo);
      console.log('valor documento', documento);
      console.log('valor documento tutor', documento_tutor);

      const alumno = await pool.query('select documento, apellido, nom2 as nombre, sexo, SUBSTRING(fecha_nacimiento, 9,2) dia_nac, SUBSTRING(fecha_nacimiento, 6,2) mes_nac, SUBSTRING(fecha_nacimiento, 1,4) anio_nac, domicilio, localidad, provincia, telefono, lugar_nacimiento, nacionalidad,SUBSTRING(bautismo_fecha, 9,2) dia_bauti,SUBSTRING(bautismo_fecha, 6,2) mes_bauti,SUBSTRING(bautismo_fecha, 1,4) anio_bauti, bautismo_lugar,SUBSTRING(comunion_fecha, 9,2) dia_comuni, SUBSTRING(comunion_fecha, 6,2) mes_comuni, SUBSTRING(comunion_fecha, 1,4) anio_comuni,comunion_lugar FROM bd_alumno where documento=? limit 1', [documento]);
      const padre = await pool.query('select a.apellido apellido_padre, a.nom2 nombre_padre, a.nacionalidad nacionalidad_padre, b.documento_padre, a.domicilio domi_padre, a.localidad localidad_padre, a.provincia provincia_padre, a.profesion profesion_padre, a.telefono_particular telef_padre,  celular celular_padre, a.telefono_laboral telef_laboral_padre, a.E_MAIL email_padre from bd_padre a inner join bd_alumno b on a.documento=b.documento_padre and b.documento=? limit 1', [documento]);
      const madre = await pool.query('select a.apellido apellido_madre, a.nom2 nombre_madre, a.nacionalidad nacionalidad_madre, b.documento_madre, a.domicilio domi_madre, a.localidad localidad_madre, a.provincia provincia_madre, a.profesion profesion_madre, a.telefono_particular telef_madre,  celular celular_madre, a.telefono_laboral telef_laboral_madre, a.E_MAIL email_madre from bd_padre a inner join bd_alumno b on a.documento=b.documento_madre and b.documento=? limit 1', [documento]);
      const tutor = await pool.query('select a.apellido apellido_tutor, a.nom2 nombre_tutor, a.nacionalidad nacionalidad_tutor, a.documento documento_tutor, a.domicilio domi_tutor, a.localidad localidad_tutor, a.provincia provincia_tutor, a.profesion profesion_tutor, a.telefono_particular telef_tutor,  celular celular_tutor, a.telefono_laboral telef_laboral_tutor, a.E_MAIL email_tutor from bd_padre a where a.documento=?  limit 1', [documento_tutor]);
      
      console.log(alumno);
      var datos={
        ciclo_lectivo: ciclo_lectivo,
        alumno: alumno,
        padre: padre,
        madre: madre,
        tutor: tutor
    };
    console.log(datos);
      res.render('inscripcion/new_primaria.hbs', datos );
  });

  router.get('/new_secundaria', async (req, res) => {
    var ciclo_lectivo = ciclo_inscrip;
      var documento = documento_inscrip;
      var documento_tutor = documento_tutor_inscrip;

      console.log('entro en inscripcion nueva primaria - ');
      console.log('valor cilo', ciclo_lectivo);
      console.log('valor documento', documento);
      console.log('valor documento tutor', documento_tutor);

      const alumno = await pool.query('select documento, apellido, nom2 as nombre, sexo, SUBSTRING(fecha_nacimiento, 9,2) dia_nac, SUBSTRING(fecha_nacimiento, 6,2) mes_nac, SUBSTRING(fecha_nacimiento, 1,4) anio_nac, domicilio, localidad, provincia, telefono, lugar_nacimiento, nacionalidad,SUBSTRING(bautismo_fecha, 9,2) dia_bauti,SUBSTRING(bautismo_fecha, 6,2) mes_bauti,SUBSTRING(bautismo_fecha, 1,4) anio_bauti, bautismo_lugar,SUBSTRING(comunion_fecha, 9,2) dia_comuni, SUBSTRING(comunion_fecha, 6,2) mes_comuni, SUBSTRING(comunion_fecha, 1,4) anio_comuni,comunion_lugar FROM bd_alumno where documento=? limit 1', [documento]);
      const padre = await pool.query('select a.apellido apellido_padre, a.nom2 nombre_padre, a.nacionalidad nacionalidad_padre, b.documento_padre, a.domicilio domi_padre, a.localidad localidad_padre, a.provincia provincia_padre, a.profesion profesion_padre, a.telefono_particular telef_padre,  celular celular_padre, a.telefono_laboral telef_laboral_padre, a.E_MAIL email_padre from bd_padre a inner join bd_alumno b on a.documento=b.documento_padre and b.documento=? limit 1', [documento]);
      const madre = await pool.query('select a.apellido apellido_madre, a.nom2 nombre_madre, a.nacionalidad nacionalidad_madre, b.documento_madre, a.domicilio domi_madre, a.localidad localidad_madre, a.provincia provincia_madre, a.profesion profesion_madre, a.telefono_particular telef_madre,  celular celular_madre, a.telefono_laboral telef_laboral_madre, a.E_MAIL email_madre from bd_padre a inner join bd_alumno b on a.documento=b.documento_madre and b.documento=? limit 1', [documento]);
      const tutor = await pool.query('select a.apellido apellido_tutor, a.nom2 nombre_tutor, a.nacionalidad nacionalidad_tutor, a.documento documento_tutor, a.domicilio domi_tutor, a.localidad localidad_tutor, a.provincia provincia_tutor, a.profesion profesion_tutor, a.telefono_particular telef_tutor,  celular celular_tutor, a.telefono_laboral telef_laboral_tutor, a.E_MAIL email_tutor from bd_padre a where a.documento=?  limit 1', [documento_tutor]);
      
      console.log(alumno);
      var datos={
        ciclo_lectivo: ciclo_lectivo,
        alumno: alumno,
        padre: padre,
        madre: madre,
        tutor: tutor
    };
    console.log(datos);
      res.render('inscripcion/new_secundaria.hbs', datos );
});

router.post('/new_inicial', async (req, res) => {
  const datos = req.body;
   console.log('form de  inscripcion inicial enviado  ');
   var nro_inscripcion = await pool.query('select nextval(\'inicial\') as nroinscripcion ');
  console.log('valor de nro de inscripcion =',nro_inscripcion[0].nroinscripcion);

  var values1 ={
    id_ciclo: 1,
    id_nivel: 1,
    nro_inscripcion: nro_inscripcion[0].nroinscripcion,
    fr_alu_docu: datos.fr_s1_documento,
    form_cargado: 'S'
   };

var id_frs2padres =0;
var docum = datos.fr_s1_documento;

var id_alumno=0;
var id_tutor = 0;
id_inscripcion=0;


 //Insrta inscripciones
 console.log('values1 = ', values1);
 pool.query('INSERT INTO inscripciones set ?', [values1], async function (error, results) {
  if (error) throw error;
  console.log('insertado en inscripciones');
  id_inscripcion=results.insertId;
  //lee id insert inscripciones
 console.log('Insertado inscripciones correctamente, id = ', id_inscripcion);

 console.log('antes del if');
 var id_transac=0; 
 if (id_inscripcion > 0)
 {
  const db = makeDb( database );

  try {
    await db.beginTransaction();
    console.log('Inicio de transaccion');

    //inserta alumnos
        var alumno ={
          id_inscripcion,
          fr_s1_apellido: datos.fr_s1_apellido,
          fr_s1_nombre  : datos.fr_s1_nombre,
          fr_s1_sexo    : datos.fr_s1_sexo,
          fr_s1_sala    : datos.fr_s1_sala,
          fr_s1_seccion : datos.fr_s1_seccion,
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
         await db.query('INSERT INTO fr_s1_alumno set ?', [alumno],  function(err, result) { if (err) throw err;  id_alumno = result.insertId; });
         console.log('Insertado alumno correctamente, id = ', id_alumno);
       //Procesa Insert Padres
           var padres ={
                id_inscripcion,
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
               };
               await db.query('INSERT INTO fr_s2_padres set ?', [padres], function(err, result) { if (err) throw err;  id_frs2padres = result.insertId;});
               
               console.log('Insertado padres correctamente ', id_frs2padres);
           //Procesa grupo familiar      
          var frs2_apynom_fam = datos.fr_s2_apynom_fam;
          var frs2_parentesco = datos.fr_s2_parentesco;
          var frs2_edad  = datos.fr_s2_edad;
          var frs2_grupo_riesgo = datos.fr_s2_grupo_riesgo;
          console.log('grupo fam - fr_s2_apynom ', frs2_apynom_fam);
           if (typeof(frs2_apynom_fam) != "undefined")
           {
              if (frs2_apynom_fam.length > 1)
              {
                  var aux=0;
                  // Hay grupo familiar cargado
                  for (var i=1; i<frs2_apynom_fam.length; i++) 
                  { 
                  
                    var grupofarm = {
                    fr_s1_documento : datos.fr_s1_documento,
                    id_frs2padres,
                    id_inscripcion,
                    fr_s2_apynom_fam : frs2_apynom_fam[i],
                    fr_s2_parentesco : frs2_parentesco[i],
                    fr_s2_edad       : frs2_edad[i],
                    fr_s2_grupo_riesgo : frs2_grupo_riesgo[i]	  
                    };
                    await db.query('INSERT INTO fr_s2_grupofamiliar set ?', [grupofarm] );
                  }
                }
            } 
            console.log('Iniciando Tutor');
                // Procesa tutor
                      var tutor = {
                        fr_s1_documento : datos.fr_s1_documento,
                        id_inscripcion,
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
                      };

                      await db.query('INSERT INTO fr_s3_tutor set ?', [tutor], function(err, result) { if (err) throw err;  id_tutor = result.insertId;});
                      
                      console.log('Insertado tutor correctamente ', id_tutor);
                             
         // Procesa antecentes medicos 
         console.log('Iniciaando antec medicos ');
            var antec_emedico = {
              id_inscripcion,
              fr_s1_documento : datos.fr_s1_documento,
              fr_s4_grupo_riesgo_1 : datos.fr_s4_grupo_riesgo_1,
              fr_s4_grupo_riesgo_2 : datos.fr_s4_grupo_riesgo_2,
              fr_s4_grupo_riesgo_3 : datos.fr_s4_grupo_riesgo_3,
              fr_s4_grupo_riesgo_4 : datos.fr_s4_grupo_riesgo_4
            };

            await db.query('INSERT INTO fr_s4_antec_medico_alu set ?', [antec_emedico]);
            console.log('Insertado antecedentes medicos correctamente ');
         //Procesa Autorizaciones                 
         console.log('Iniciaando autoriz ');  
        var frs5_apynom_autoriz = datos.fr_s5_apynom_autoriz;
        var frs5_dni_autoriz = datos.fr_s5_dni_autoriz;
        var frs5_parentesco_autoriz  = datos.fr_s5_parentesco_autoriz;
        var frs5_telef_autoriz = datos.fr_s5_telef_autoriz;
        console.log('grupo fam  autoriz - frs5_apynom_autoriz ', frs5_apynom_autoriz);
        if (typeof(frs5_apynom_autoriz) != "undefined")
        {
            if (frs5_apynom_autoriz.length > 1)
            {
             
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
               
               await db.query('INSERT INTO fr_s5_autorizazion set ?', [grupoautoriz] );
              }
            }
        }
      


    // si todo fue bien hace commit
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

 }
 
 
 if(id_transac === 1)
 {
  res.redirect('/inscripcion/mensaje1');
 }
 else{
  res.redirect('/inscripcion/new_inicial_error');
 }

 });
  
 
});


router.post('/new_primaria', async (req, res) => {
    const datos = req.body;
     console.log('form de  inscripcion primaria enviado  ');
     var nro_inscripcion = await pool.query('select nextval(\'primaria\') as nroinscripcion ');
    console.log('valor de nro de inscripcion =',nro_inscripcion[0].nroinscripcion);

    var values1 ={
      id_ciclo: 1,
      id_nivel: 2,
      nro_inscripcion: nro_inscripcion[0].nroinscripcion,
      fr_alu_docu: datos.fr_s1_documento,
      form_cargado: 'S'
     };
  
  var id_frs2padres =0;
  var docum = datos.fr_s1_documento;
  
  var id_alumno=0;
  var id_tutor = 0;
  id_inscripcion=0;

  
   //Insrta inscripciones
   console.log('values1 = ', values1);
   pool.query('INSERT INTO inscripciones set ?', [values1], async function (error, results) {
    if (error) throw error;
    console.log('insertado en inscripciones');
    id_inscripcion=results.insertId;
    //lee id insert inscripciones
   console.log('Insertado inscripciones correctamente, id = ', id_inscripcion);

   console.log('antes del if');
   var id_transac=0; 
   if (id_inscripcion > 0)
   {
    const db = makeDb( database );
  
    try {
      await db.beginTransaction();
      console.log('Inicio de transaccion');

      //inserta alumnos
          var alumno ={
            id_inscripcion,
            fr_s1_apellido: datos.fr_s1_apellido,
            fr_s1_nombre  : datos.fr_s1_nombre,
            fr_s1_sexo    : datos.fr_s1_sexo,
            fr_s1_grado   : datos.fr_s1_grado,
            fr_s1_seccion : datos.fr_s1_seccion,
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
           await db.query('INSERT INTO fr_s1_alumno set ?', [alumno],  function(err, result) { if (err) throw err;  id_alumno = result.insertId; });
           console.log('Insertado alumno correctamente, id = ', id_alumno);
         //Procesa Insert Padres
             var padres ={
                  id_inscripcion,
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
                 };
                 await db.query('INSERT INTO fr_s2_padres set ?', [padres], function(err, result) { if (err) throw err;  id_frs2padres = result.insertId;});
                 
                 console.log('Insertado padres correctamente ', id_frs2padres);
             //Procesa grupo familiar      
            var frs2_apynom_fam = datos.fr_s2_apynom_fam;
            var frs2_parentesco = datos.fr_s2_parentesco;
            var frs2_edad  = datos.fr_s2_edad;
            var frs2_grupo_riesgo = datos.fr_s2_grupo_riesgo;
            console.log('grupo fam - fr_s2_apynom ', frs2_apynom_fam);
             if (typeof(frs2_apynom_fam) != "undefined")
             {
                if (frs2_apynom_fam.length > 1)
                {
                    var aux=0;
                    // Hay grupo familiar cargado
                    for (var i=1; i<frs2_apynom_fam.length; i++) 
                    { 
                    
                      var grupofarm = {
                      fr_s1_documento : datos.fr_s1_documento,
                      id_frs2padres,
                      id_inscripcion,
                      fr_s2_apynom_fam : frs2_apynom_fam[i],
                      fr_s2_parentesco : frs2_parentesco[i],
                      fr_s2_edad       : frs2_edad[i],
                      fr_s2_grupo_riesgo : frs2_grupo_riesgo[i]	  
                      };
                      await db.query('INSERT INTO fr_s2_grupofamiliar set ?', [grupofarm] );
                    }
                  }
              } 
              console.log('Iniciando Tutor');
                  // Procesa tutor
                        var tutor = {
                          fr_s1_documento : datos.fr_s1_documento,
                          id_inscripcion,
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
                        };
  
                        await db.query('INSERT INTO fr_s3_tutor set ?', [tutor], function(err, result) { if (err) throw err;  id_tutor = result.insertId;});
                        
                        console.log('Insertado tutor correctamente ', id_tutor);
                               
           // Procesa antecentes medicos 
           console.log('Iniciaando antec medicos ');
              var antec_emedico = {
                id_inscripcion,
                fr_s1_documento : datos.fr_s1_documento,
                fr_s4_grupo_riesgo_1 : datos.fr_s4_grupo_riesgo_1,
                fr_s4_grupo_riesgo_2 : datos.fr_s4_grupo_riesgo_2,
                fr_s4_grupo_riesgo_3 : datos.fr_s4_grupo_riesgo_3,
                fr_s4_grupo_riesgo_4 : datos.fr_s4_grupo_riesgo_4
              };
  
              await db.query('INSERT INTO fr_s4_antec_medico_alu set ?', [antec_emedico]);
              console.log('Insertado antecedentes medicos correctamente ');
           //Procesa Autorizaciones                 
           console.log('Iniciaando autoriz ');  
          var frs5_apynom_autoriz = datos.fr_s5_apynom_autoriz;
          var frs5_dni_autoriz = datos.fr_s5_dni_autoriz;
          var frs5_parentesco_autoriz  = datos.fr_s5_parentesco_autoriz;
          var frs5_telef_autoriz = datos.fr_s5_telef_autoriz;
          console.log('grupo fam  autoriz - frs5_apynom_autoriz ', frs5_apynom_autoriz);
          if (typeof(frs5_apynom_autoriz) != "undefined")
          {
              if (frs5_apynom_autoriz.length > 1)
              {
               
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
                 
                 await db.query('INSERT INTO fr_s5_autorizazion set ?', [grupoautoriz] );
                }
              }
          }
        
  
  
      // si todo fue bien hace commit
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

   }
   
   
   if(id_transac === 1)
   {
    res.redirect('/inscripcion/mensaje1');
   }
   else{
    res.redirect('/inscripcion/new_primaria_error');
   }

   });
    
   
 
   
    
});

router.post('/new_secundaria', async (req, res) => {
  const datos = req.body;
   console.log('form de  inscripcion secundaria enviado  ');
   var nro_inscripcion = await pool.query('select nextval(\'secundaria\') as nroinscripcion ');
  console.log('valor de nro de inscripcion =',nro_inscripcion[0].nroinscripcion);

  var values1 ={
    id_ciclo: 1,
    id_nivel: 3,
    nro_inscripcion: nro_inscripcion[0].nroinscripcion,
    fr_alu_docu: datos.fr_s1_documento,
    form_cargado: 'S'
   };

var id_frs2padres =0;
var docum = datos.fr_s1_documento;

var id_alumno=0;
var id_tutor = 0;
id_inscripcion=0;


 //Insrta inscripciones
 console.log('values1 = ', values1);
 pool.query('INSERT INTO inscripciones set ?', [values1], async function (error, results) {
  if (error) throw error;
  console.log('insertado en inscripciones');
  id_inscripcion=results.insertId;
  //lee id insert inscripciones
 console.log('Insertado inscripciones correctamente, id = ', id_inscripcion);

 console.log('antes del if');
 var id_transac=0; 
 if (id_inscripcion > 0)
 {
  const db = makeDb( database );

  try {
    await db.beginTransaction();
    console.log('Inicio de transaccion');

    //inserta alumnos
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
         await db.query('INSERT INTO fr_s1_alumno set ?', [alumno],  function(err, result) { if (err) throw err;  id_alumno = result.insertId; });
         console.log('Insertado alumno correctamente, id = ', id_alumno);
       //Procesa Insert Padres
           var padres ={
                id_inscripcion,
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
               };
               await db.query('INSERT INTO fr_s2_padres set ?', [padres], function(err, result) { if (err) throw err;  id_frs2padres = result.insertId;});
               
               console.log('Insertado padres correctamente ', id_frs2padres);
           //Procesa grupo familiar      
          var frs2_apynom_fam = datos.fr_s2_apynom_fam;
          var frs2_parentesco = datos.fr_s2_parentesco;
          var frs2_edad  = datos.fr_s2_edad;
          var frs2_grupo_riesgo = datos.fr_s2_grupo_riesgo;
          console.log('grupo fam - fr_s2_apynom ', frs2_apynom_fam);
           if (typeof(frs2_apynom_fam) != "undefined")
           {
              if (frs2_apynom_fam.length > 1)
              {
                  var aux=0;
                  // Hay grupo familiar cargado
                  for (var i=1; i<frs2_apynom_fam.length; i++) 
                  { 
                  
                    var grupofarm = {
                    fr_s1_documento : datos.fr_s1_documento,
                    id_frs2padres,
                    id_inscripcion,
                    fr_s2_apynom_fam : frs2_apynom_fam[i],
                    fr_s2_parentesco : frs2_parentesco[i],
                    fr_s2_edad       : frs2_edad[i],
                    fr_s2_grupo_riesgo : frs2_grupo_riesgo[i]	  
                    };
                    await db.query('INSERT INTO fr_s2_grupofamiliar set ?', [grupofarm] );
                  }
                }
            } 
            console.log('Iniciando Tutor');
                // Procesa tutor
                      var tutor = {
                        fr_s1_documento : datos.fr_s1_documento,
                        id_inscripcion,
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
                      };

                      await db.query('INSERT INTO fr_s3_tutor set ?', [tutor], function(err, result) { if (err) throw err;  id_tutor = result.insertId;});
                      
                      console.log('Insertado tutor correctamente ', id_tutor);
                             
         // Procesa antecentes medicos 
         console.log('Iniciaando antec medicos ');
            var antec_emedico = {
              id_inscripcion,
              fr_s1_documento : datos.fr_s1_documento,
              fr_s4_grupo_riesgo_1 : datos.fr_s4_grupo_riesgo_1,
              fr_s4_grupo_riesgo_2 : datos.fr_s4_grupo_riesgo_2,
              fr_s4_grupo_riesgo_3 : datos.fr_s4_grupo_riesgo_3,
              fr_s4_grupo_riesgo_4 : datos.fr_s4_grupo_riesgo_4
            };

            await db.query('INSERT INTO fr_s4_antec_medico_alu set ?', [antec_emedico]);
            console.log('Insertado antecedentes medicos correctamente ');
         //Procesa Autorizaciones                 
         console.log('Iniciaando autoriz ');  
        var frs5_apynom_autoriz = datos.fr_s5_apynom_autoriz;
        var frs5_dni_autoriz = datos.fr_s5_dni_autoriz;
        var frs5_parentesco_autoriz  = datos.fr_s5_parentesco_autoriz;
        var frs5_telef_autoriz = datos.fr_s5_telef_autoriz;
        console.log('grupo fam  autoriz - frs5_apynom_autoriz ', frs5_apynom_autoriz);
        if (typeof(frs5_apynom_autoriz) != "undefined")
        {
            if (frs5_apynom_autoriz.length > 1)
            {
             
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
               
               await db.query('INSERT INTO fr_s5_autorizazion set ?', [grupoautoriz] );
              }
            }
        }
      


    // si todo fue bien hace commit
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

 }
 
 
 if(id_transac === 1)
 {
  res.redirect('/inscripcion/mensaje1');
 }
 else{
  res.redirect('/inscripcion/new_secundaria_error');
 }

 });
  
 
  
});



router.get('/mensaje1', async (req, res) => {
    console.log('entro a mensaje1  ');
    res.render('inscripcion/mensaje1', {documento_inscrip,id_inscripcion});
});

router.get('/informa_pago', async (req, res) => {
   console.log('entro a informar pago  ');
   console.log('informar pago - documento  ', documento_inscrip);
   console.log('informar pago - id_inscripcion  ', id_inscripcion);
   res.render('inscripcion/informa_pago', {documento_inscrip});
});

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../public/uploads/pagos'),
  filename:  (req, file, cb) => {
      cb(null, documento_inscrip+"_"+file.originalname);
  }
})
const uploadImage = multer({
  storage,
  limits: {fileSize: 1000000}
}).single('image');

router.post('/informa_pago', async  (req, res) => {
  uploadImage (req, res, async (err) => {
    if (err) {
       
        flash.message('El archivo supera el límite de hasta un megabyte.');
    }
    else
    {
      const  { image } = req.body;
      const archivo = req.file.path;
      const  id  = id_inscripcion;
      console.log('id inscrip en informa pago - ',id);
      console.log('id inscrip en informa pago - ', id_inscripcion);
      
      console.log(req.file);
      console.log(archivo);
      console.log(image);
  
      await pool.query('UPDATE inscripciones set pago_inscrip=?, url_pago=? WHERE id_inscripcion = ?', ['S',archivo,id_inscripcion]);
      res.redirect('/inscripcion/pre-inscripcion_ok');
    }
    
});
});

router.get('/pre-inscripcion_ok', async (req, res) => {
  console.log('mensaje de pago ok - preinscripcion ok  ');
  console.log('documento insrip =  ', documento_inscrip);
  res.render('inscripcion/mensaje_pago_ok', {documento_inscrip,id_inscripcion});
});

router.get('/mensaje2', async (req, res) => {

    console.log('entro en mensaje2  ');
    console.log(documento_inscrip);
    res.render('inscripcion/mensaje2', {documento_inscrip});
});

router.get('/edit', async (req, res) => {
 
  const alumno = await pool.query('select * from fr_s1_alumno where id_inscripcion= ? limit 1', [id_inscripcion]);
  const padres = await pool.query('select * from fr_s2_padres where id_inscripcion= ? limit 1', [id_inscripcion]);
  const grupofam = await pool.query('select * from fr_s2_grupofamiliar where id_inscripcion= ? order by id_frs2grupofam asc', [id_inscripcion]);
  const antemedico = await pool.query('select * from fr_s4_antec_medico_alu where id_inscripcion= ? limit 1', [id_inscripcion]);
  const tutor = await pool.query('select * from fr_s3_tutor where id_inscripcion= ? limit 1', [id_inscripcion]);
  const autorizretiro = await pool.query('select * from fr_s5_autorizazion where id_inscripcion= ? order by id_frs5autorizacion asc', [id_inscripcion]);

  if (nivel_inscrip === 'I') {
    res.render('inscripcion/edit_inicial', {ciclo_inscrip,alumno,padres, grupofam, antemedico,tutor,autorizretiro});   
  } else if (nivel_inscrip === 'P') {
    console.log('entro en edit primaria  ');
    console.log(alumno);
    console.log(antemedico)
    res.render('inscripcion/edit_primaria', {ciclo_inscrip,alumno,padres, grupofam, antemedico,tutor,autorizretiro});   
  } else if (nivel_inscrip === 'S') {
    res.render('inscripcion/edit_secundaria', {ciclo_inscrip,alumno,padres, grupofam, antemedico,tutor,autorizretiro});   
  }

});

router.get('/mensaje3', async (req, res) => {
 
    console.log('entro en mensaje3  ');
    res.render('inscripcion/mensaje3', {documento_inscrip,id_inscripcion});
});

router.get('/edit_error', async (req, res) => {
   console.log('entro en edit error  ');
  res.render('inscripcion/edit_error', {documento_inscrip});
});

router.post('/edit_inicial', async (req, res) => {
  const datos = req.body; 
  const id  = id_inscripcion
  
  const db = makeDb( database );

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
            fr_s1_sala   : datos.fr_s1_sala,
            fr_s1_seccion : datos.fr_s1_seccion,
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
  res.redirect('/inscripcion/edit_ok');
 }
 else{
  res.redirect('/inscripcion/edit_error');
 }
  
   
});


router.post('/edit_primaria', async (req, res) => {
  const datos = req.body; 
  const id  = id_inscripcion
  
  const db = makeDb( database );

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
            fr_s1_grado   : datos.fr_s1_grado,
            fr_s1_seccion : datos.fr_s1_seccion,
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
  res.redirect('/inscripcion/edit_ok');
 }
 else{
  res.redirect('/inscripcion/edit_error');
 }
  
   
});

router.post('/edit_secundaria', async (req, res) => {
  const datos = req.body; 
  const id  = id_inscripcion
  
  const db = makeDb( database );

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
  res.redirect('/inscripcion/edit_ok');
 }
 else{
  res.redirect('/inscripcion/edit_error');
 }
  
   
});

router.get('/edit_ok', async (req, res) => {
    console.log('entro en edit ok  ');
    res.render('inscripcion/edit_ok');
});
module.exports = router;