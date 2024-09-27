const axios = require('axios');
const { generateSignature } = require('../utils/generateSignature');
const User = require('../models/userModel'); // Asegúrate de usar el modelo

// Redirige a Last.fm para autenticación
const redirectToLastFm = (req, res) => {
  const apiKey = process.env.LASTFM_API_KEY;
  const callbackUrl = process.env.CALLBACK_URL;
  const authUrl = `https://www.last.fm/api/auth/?api_key=${apiKey}&cb=${callbackUrl}`;
  res.redirect(authUrl);
};

// Callback después de autenticarse
const lastFmCallback = async (req, res) => {
  const token = req.query.token;
  const apiKey = process.env.LASTFM_API_KEY;
  const apiSecret = process.env.LASTFM_API_SECRET;

  const apiSig = generateSignature({
    api_key: apiKey,
    method: 'auth.getSession',
    token: token,
  }, apiSecret);

  try {
    const response = await axios.get(
      `https://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=${apiKey}&token=${token}&api_sig=${apiSig}&format=json`
    );

    const session = response.data.session;

    if (!session || !session.name || !session.key) {
      return res.status(400).json({ error: 'Sesión inválida' });
    }

    // Obtener detalles del perfil del usuario
    const profileResponse = await axios.get(
      `https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${session.name}&api_key=${apiKey}&format=json`
    );

    const userInfo = profileResponse.data.user;
    const profileImage = userInfo.image.find(img => img.size === 'large')['#text']; // La imagen de perfil
    const isPro = userInfo.subscriber === '1';  // Comprobar si es usuario Pro

    // Almacenar en la base de datos
    const [user, created] = await User.findOrCreate({
      where: { username: session.name },
      defaults: {
        session_key: session.key,
        profile_image: profileImage,  // Almacenar la foto de perfil
        is_pro: isPro,  // Almacenar el estado de suscripción
      }
    });
    
    if (!created) {
      // Si el usuario ya existe, actualiza la imagen de perfil y el estado Pro
      user.profile_image = profileImage;
      user.is_pro = isPro;
      await user.save();  // Guardar los cambios
    }

    res.redirect('http://localhost:3000/dashboard');
  } catch (error) {
    console.error('Error durante la autenticación:', error);
    res.status(500).send('Error durante la autenticación');
  }
};

module.exports = { redirectToLastFm, lastFmCallback };
