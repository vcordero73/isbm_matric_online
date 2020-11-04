module.exports = {
    isLoggedIn (req, res, next) {
        if (req.isAuthenticated()) {
            console.log('entro en isAuthenticated de isLoggedIn');
            return next();
        }
        console.log('NO ---- entro en isAuthenticated de isLoggedIn');
        return res.redirect('/signin');
    },

    isNotLoggedIn (req, res, next) {
        if (!req.isAuthenticated()) {
            console.log('entro en ! isAuthenticated de isNotLoggedIn');
            return next();
        }
        console.log('NO ---- entro en isAuthenticated de isNotLoggedIn');
        return res.redirect('/sigin');
    }
};