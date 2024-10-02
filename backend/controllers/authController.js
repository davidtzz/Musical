const axios = require('axios');
const User = require('../models/userModel');
const crypto = require('crypto');

// Redirige a Last.fm para autenticación
const redirectToLastFm = (req, res) => {
  const apiKey = 'c8c448175ee92bd1dac3f498aae48741';
  const authUrl = `https://www.last.fm/api/auth/?api_key=${apiKey}&cb=http://tu_dominio/lastfm/callback`; // Asegúrate de cambiar 'tu_dominio'
  console.log('Redirecting to:', authUrl);
  res.redirect(authUrl);
};

// Callback de Last.fm para guardar la sesión y el usuario en la base de datos
const lastFmCallback = async (req, res) => {
  const apiKey = 'c8c448175ee92bd1dac3f498aae48741';
  const apiSecret = '4320daff6a0243097f01c7c13d5fa1fa'; // Clave secreta de Last.fm
  const token = req.query.token; // El token debe ser parte de la query string

  if (!token) {
    return res.status(400).send('Token not found');
  }

  // Crear la firma API (api_sig)
  const apiSig = crypto
    .createHash('md5')
    .update(`api_key${apiKey}methodauth.getSessiontoken${token}${apiSecret}`)
    .digest('hex');

  // Hacer la solicitud para obtener la sesión
  const getSessionUrl = `https://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=${apiKey}&token=${token}&api_sig=${apiSig}&format=json`;

  try {
    const response = await axios.get(getSessionUrl);
    const session = response.data.session;

    if (!session || !session.name || !session.key) {
      return res.status(500).send('Error obteniendo la sesión');
    }

    // Buscar si el usuario ya existe en la base de datos
    let user = await User.findOne({ where: { username: session.name } });

    if (user) {
      // Si el usuario ya existe, actualiza su session_key
      user.session_key = session.key;
      await user.save();
    } else {
      // Si el usuario no existe, crea un nuevo registro
      user = await User.create({
        username: session.name,
        session_key: session.key,
        profile_image: '', // Puedes obtener la imagen más tarde y actualizarla
        is_pro: false, // Puedes actualizar este campo dependiendo de si es pro o no
      });
    }

    // Guarda el nombre de usuario en la sesión de Express
    req.session.username = session.name;
    req.session.key = session.key;

    // Redirige al usuario al dashboard o a la página que desees
    res.redirect('https://main.d3swbnx2em39af.amplifyapp.com/dashboard');
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).send('Error during authentication');
  }
};

// Función para cerrar la sesión
const logout = (req, res) => {
  if (req.session) {
    req.session.destroy(err => {
      if (err) {
        return res.status(500).send('Error al cerrar la sesión');
      } else {
        res.clearCookie('connect.sid');
        return res.status(200).send('Sesión cerrada correctamente');
      }
    });
  } else {
    res.status(200).send('No había sesión activa');
  }
};

module.exports = { redirectToLastFm, lastFmCallback, logout };
