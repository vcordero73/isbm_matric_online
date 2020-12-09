const express = require('express');
const router = express.Router();
const pool = require('../database');
const path = require('path');


jasper = require('node-jasper')({
    path: '../lib/jasperreports-6.16.0',
    reports: {
        hw: {
            jasper: '../reports/hello_world.jasper'
        },
        repinicial: {
            jasper: '../reports/Form_completo_inicial.jasper'
        },
        repprimaria: {
            jasper: '../reports/Form_completo_primaria.jasper'
        },
        repsecundaria: {
            jasper: '../reports/Form_completo_secundaria.jasper'
        }
    },
    drivers: {
        mysql: {
            path: '../lib/mysql-connector-java-5.1.6-bin.jar',
            class: 'com.mysql.jdbc.Driver', 
            type: 'mysql'
        }
    },
    conns: {
        srv_isbm_io: {
            jdbc: 'jdbc:mysql://66.97.37.212/vcordero_isbm_io',
            port: 3306,
            user: 'vcordero_isbm_io',
            pass: 'Matias@7043',
            driver: 'mysql'
        }
    },
    defaultConn: 'srv_isbm_io'
});

router.get('/report', function(req, res, next) {
    //reporte por nivel y documento
    let nivel_inscrip = req.session.nivel_inscrip;
    
    console.log('entro en report con nivel =  ',nivel_inscrip);
    
  if (nivel_inscrip === 'I') {
    res.redirect('/report_inicial');   
  } else if (nivel_inscrip === 'P') {
    res.redirect('/report_primaria');   
  } else if (nivel_inscrip === 'S') {
    res.redirect('report_secundaria');   
  }

});

router.get('/report_inicial', function(req, res, next) {
    let documento = req.session.documento_inscrip;
    let report = {
        report: 'repinicial',
         data: {
             p_documento: documento
        }
    };
    console.log('entro en report_inicial ');
    let pdf = jasper.pdf(report);
    res.set({
        'Content-type': 'application/pdf',
        'Content-Length': pdf.length
    });
    res.send(pdf);
});

router.get('/report_primaria', function(req, res, next) {
    let documento = req.session.documento_inscrip;
    let report = {
        report: 'repprimaria',
         data: {
             p_documento: documento
        }
    };
    console.log('entro en report_primaria ');
    let pdf = jasper.pdf(report);
    res.set({
        'Content-type': 'application/pdf',
        'Content-Length': pdf.length
    });
    res.send(pdf);
});

router.get('/report_secundaria', function(req, res, next) {
    let documento = req.session.documento_inscrip;
    let report = {
        report: 'repsecundaria',
         data: {
             p_documento: documento
        }
    };
    console.log('entro en report_secundaria');
    let pdf = jasper.pdf(report);
    res.set({
        'Content-type': 'application/pdf',
        'Content-Length': pdf.length
    });
    res.send(pdf);
});

module.exports = router;