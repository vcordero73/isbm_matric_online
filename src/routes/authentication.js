const express = require('express');
const { body, validationResult, check } = require('express-validator');
const router = express.Router();

const passport = require('passport');
const { isLoggedIn, isNotLoggedIn } = require('../lib/auth');

// SIGNUP
router.get('/signup',isNotLoggedIn, (req, res) => {
  res.render('auth/signup');
});

router.post('/signup',[
  check('fullname', 'Nombre completo de usuario es requerido').notEmpty(),
  check('username', 'Nombre de usuario es requerido').notEmpty(),
  check('password', 'Contraseña es requerido').notEmpty(),
  check('documento', 'Numero de Documento, sin punto,  es requerido').notEmpty().isNumeric(),
  check('nivel', 'El Nivel de Enseñanza es requerido').notEmpty()
  ], (req, res, next) => {
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(errors);
      req.flash('message', errors.errors[0].msg);
      res.redirect('/signup');
    }
    passport.authenticate('local.signup', {
      successRedirect: '/audit',
      failureRedirect: '/signup',
      failureFlash: true
    })(req, res, next);
  });


// SINGIN
router.get('/signin',isNotLoggedIn, (req, res) => {
  res.render('auth/signin');
});

router.post('/signin',[
check('username', 'Nombre de usuario es requerido').notEmpty(),
check('password', 'Contraseña es requerido').notEmpty()
], (req, res, next) => {
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors);
    req.flash('message', errors.errors[0].msg);
    res.redirect('/signin');
  }
  passport.authenticate('local.signin', {
    successRedirect: '/audit',
    failureRedirect: '/signin',
    failureFlash: true
  })(req, res, next);
});


router.get('/profile', isLoggedIn, (req, res) => {
    res.render('profile');
  });

router.get('/logout', isLoggedIn, (req, res) => {
    console.log('Cerrando la session');
    req.logOut();
    res.redirect('/signin');
  });

module.exports = router;
