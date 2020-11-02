//sera utilizado para almacenar todas las rutas principales de la apicacion
// una ruta por ejemplo de bienvenida al usuario, para mostrar el acerca de, contacto,

//primero requerimos express para definir las rutas
// llamamos al metodo router para ello y creamos un objeto del tipo router
const express = require('express');
const router  = express.Router();

router.get('/', async (req, res) => {
    res.render('index');
});

module.exports = router;
