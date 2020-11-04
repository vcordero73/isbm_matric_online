const express = require('express');
const morgan  = require('morgan');
const exphbs= require('express-handlebars');
const passport = require('passport');
const path = require('path');
const session = require('express-session');
const validator = require('express-validator');
const MySQLStore = require('express-mysql-session')(session);
const flash = require('connect-flash');
const bodyParser = require('body-parser');
const { database } = require('./keys');

const multer = require('multer');




//Iniciarlizar express
const app = express();
require('./lib/passport');

//Configuraciones que necesita el servidor
// 1) en que puerto va funcionar, basicamente dice voy a definir un puerto si el server existe tomalo sino usa el 3000
app.set('port', process.env.PORT  || 8443);

//2) Configura plantilla de handlebars
// primero crea una constante views, con el path raiz (./src) y la subcartepa 'views', asi crea un camino hasta alli
// luego configura la plantilla, setea un objeto y setea la ingenieria de vistas 
app.set('views', path.join(__dirname, 'views'));
app.engine('.hbs', exphbs({
  defaultLayout: 'main',
  layoutsDir: path.join(app.get('views'), 'layouts'),
  partialsDir: path.join(app.get('views'), 'partials'),
  extname: '.hbs',
  helpers: require('./lib/handlebars')
}))
app.set('view engine', '.hbs');

//Middlewares
//son funciones que se ejecutan cada vez que un usuario envia una peticion
// una aplicacion cliente envia una peticion al servidor
//1) ejemplo morgan, dice que use morgan para que muestre determinado mensaje por consola, con esto veo que esta llegando al servidor
app.use(morgan('dev'));
//2) urlencode para poder aceptar los datos que me envian los usuarios desde formularios, extended: false, significa que aceptara datos
//sencillos como string, y otros, no imagenes por ejemplo
app.use(bodyParser.urlencoded({extended: false}));
// 3) para aceptar enviar y recibir JSON
app.use(bodyParser.json());
app.use(session({
  secret: 'vocmysqlnodemysql',
  resave: false,
  saveUninitialized: false,
  store: new MySQLStore(database)
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

//app.use(multer({storage1}).single('image'));

// variagles globales
//aqui coloo variables que toda mi aplicacion necesite
// podria por ejemplo crear una variable con el nombre de mi aplicacion, en cualquier vista o archivo que envie al navegador podra
//usar esa variable. Otro ejemplo se usa en la autenticacion
app.use((req, res, next) => {
  app.locals.message = req.flash('message');
  app.locals.success = req.flash('success');
  app.locals.user = req.user;
          next();
  });
//Rutas
//vamos a definir las url de nuestro servidor
//que es lo que van hacer cuando un usuario visite esas url
app.use(require('./routes/index.js'));
app.use(require('./routes/authentication.js'));
app.use(require('./routes/auditoria.js'));
app.use('/inscripcion', require('./routes/inscripcion.js'));


//Public
// una carpeta donde estara todo el codigo que el servidor podra acceder
app.use(express.static(path.join(__dirname, 'public')));


//Iniciar Servidor
// una seccion para iniciar nuestro servidor
app.listen(app.get('port'), () => {
    console.log('Server on port', app.get('port') );
})