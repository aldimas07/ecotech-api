const userModel = require('../models/userModel');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const { Storage } = require('@google-cloud/storage');
const { generateTokenPair } = require('../middlewares/auth');

const getAllUsers = async (req, res) => {
  try {
    const [data] = await userModel.getAllUsers();
    res.json({
      message: 'GET all user success',
      data: data,
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
      serverMessage: error.sqlMessage,
    });
  }
};

const getUserByID = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await userModel.getUserByID(id);
    if (!user) {
      res.status(404).json({
        statusCode: 404,
        error: 'User not found',
      });
      return;
    }
    res.status(200).json({
      statusCode: 200,
      message: 'User retrieved successfully',
      data: user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      errorMessage: error.sqlMessage,
    });
  }
};

const getUserByEmail = async (req, res) => {
  const { email } = req.params;

  try {
    const [user] = await userModel.getUserByEmail(email);
    if (!user) {
      res.status(404).json({
        statusCode: 404,
        error: 'User not found',
      });
      return;
    }
    res.status(200).json({
      statusCode: 200,
      message: 'User retrieved successfully',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        password: user.password,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      errorMessage: error.sqlMessage,
    });
  }
};

const createNewUser = async (req, res) => {
  const { body } = req;
  const { name, email, password, repassword } = body;

  try {
    // if (name.length < 2) {
    //   res.status(400).json({
    //     statusCode: 400,
    //     error: 'name character minimum 2 character',
    //   });
    //   return;
    // }
    // const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // if (!emailRegex.test(email)) {
    //   res.status(400).json({
    //     statusCode: 400,
    //     error: 'Invalid. Please use valid email format',
    //   });
    //   return;
    // }
    if (password !== repassword) {
      res.status(400).json({
        statusCode: 400,
        error: 'Passwords do not match',
      });
      return;
    }
    // if (password.length < 8) {
    //   res.status(400).json({
    //     statusCode: 400,
    //     error: 'Password character at least 8',
    //   });
    //   return;
    // }
    const registeredEmail = await userModel.getUserByEmail(body.email);
    const isEmailRegistered = registeredEmail.length > 0;
    if (isEmailRegistered) {
      res.status(400).json({
        statusCode: 400,
        error: 'Email already registered',
      });
      return;
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const id = uuidv4();
    const defaultRoleUser = 3;
    await userModel.createNewUser({
      id,
      ...body,
      password: password,
      roleid: defaultRoleUser,
      image: '',
    });

    res.status(201).json({
      statusCode: 201,
      message: 'Registration successful',
      data: {
        id,
        name: body.name,
        email: body.email,
        password: hashedPassword,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      errorMessage: error.sqlMessage,
    });
  }
};

const updateUserByEmail = async (req, res) => {
  const { email } = req.params;
  const { name } = req.body;
  if (!name) {
    res.status(400).json({
      statusCode: 400,
      error: 'Name field is required',
    });
    return;
  }
  if (name.length < 2) {
    res.status(400).json({
      statusCode: 400,
      error: 'name character minimum 2 character',
    });
    return;
  }
  try {
    const [user] = await userModel.getUserByEmail(email);
    if (!user) {
      res.status(404).json({
        statusCode: 404,
        error: 'User not found',
      });
      return;
    }
    await userModel.updateUserByEmail(email, { name: req.body.name });
    res.json({
      statusCode: 200,
      message: 'User updated successfully',
      data: {
        name,
        email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      errorMessage: error.sqlMessage,
    });
  }
};

const updateUserPasswordByEmail = async (req, res) => {
  const { email } = req.params;
  const { oldPassword, newPassword, confirmNewPassword } = req.body;
  try {
    const [user] = await userModel.getUserByEmail(email);
    if (!user) {
      res.status(404).json({
        statusCode: 404,
        message: 'User not found',
      });
      return;
    }
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      res.status(401).json({
        statusCode: 401,
        message: 'Invalid old password',
      });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      res.status(400).json({
        statusCode: 400,
        message: `Password doesn't match`,
      });
      return;
    }
    if (newPassword.length && confirmNewPassword.length < 8) {
      res.status(400).json({
        statusCode: 400,
        message: 'New password at least 8 character',
      });
      return;
    }
    const hashNewPassword = await bcrypt.hash(newPassword, 10);
    await userModel.updateUserPasswordByEmail(email, hashNewPassword);

    res.status(200).json({
      statusCode: 200,
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      errorMessage: error,
      message: error.sqlMessage,
    });
  }
};

const deleteUserByID = async (req, res) => {
  const { id } = req.params;
  try {
    if (!id) {
      res.status(400).json({
        statusCode: 400,
        error: 'Invalid request. Please use parameter user ID.',
      });
      return;
    }
    const user = await userModel.getUserByID(id);
    if (!user) {
      res.status(404).json({
        statusCode: 404,
        error: 'User not found',
      });
      return;
    }
    await userModel.deleteUserByID(id);
    res.status(200).json({
      statusCode: 200,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      errorMessage: error.sqlMessage,
    });
  }
};
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const [user] = await userModel.getUserByEmail(email);
    if (!user) {
      res.status(404).json({
        statusCode: 404,
        error: 'User not found',
      });
      return;
    }
    // const isPasswordValid = await bcrypt.compare(password, user.password);
    // if (!isPasswordValid) {
    //   res.status(400).json({
    //     statusCode: 400,
    //     error: 'Invalid password',
    //   });
    //   return;
    // }

    if (password !== user.password) {
      return res.status(400).json({
        statusCode: 400,
        error: 'Invalid password',
      });
    }
    
    const { accessToken, refreshToken } = generateTokenPair(user);

    await userModel.updateUserTokenByEmail(user.email, refreshToken);

    res.status(200).json({
      statusCode: 200,
      message: 'Login successful',
      accessToken,
      refreshToken,
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      errorMessage: error,
    });
  }
};

const logout = async (req, res) => {
  const userId = req.user.id ? req.user.id : null;

  try {
    if (!userId) {
      res.status(401).json({
        statusCode: 401,
        error: 'Unauthorized',
      });
    }
    await userModel.logout(userId);

    res.status(200).json({
      statusCode: 200,
      message: 'Logout successful',
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      errorMessage: error,
    });
  }
};

const uploadProfilePhoto = async (req, res) => {
  try {
    const { email } = req.params;
    const { file } = req;
    const [user] = await userModel.getUserByEmail(email);
    if (!user) {
      res.status(404).json({
        statusCode: 404,
        error: 'User not found',
      });
      return;
    }
    // Mendapatkan token JWT dari header Authorization
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
    const decodedToken = jwt.verify(token, JWT_SECRET_KEY);
    const userId = decodedToken.id;
    if (user.id !== userId) {
      res.status(401).json({
        statusCode: 401,
        error: 'Unauthorized',
      });
      return;
    }
    const storage = new Storage();
    const bucketName = GCS_BUCKET_NAME;
    const timestamp = Date.now();
    const fileName = `${file.originalname}-${timestamp}`;
    const bucket = storage.bucket(bucketName);
    const gcsFile = bucket.file(fileName);
    const stream = gcsFile.createWriteStream({
      metadata: {
        contentType: file.mimetype,
      },
      resumable: false,
    });

    stream.on('error', (error) => {
      console.error('Error occurred during file upload:', error);
      res.status(500).json({
        statusCode: 500,
        error: 'Internal Server Error',
        errorMessage: error.message,
      });
    });

    stream.on('finish', async () => {
      const imageUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
      await userModel.updatePhotoProfileByEmail(email, { image: imageUrl });

      res.status(200).json({
        statusCode: 200,
        message: 'Profile photo uploaded successfully',
        imageUrl: imageUrl,
      });
    });

    stream.end(file.buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      errorMessage: error,
    });
  }
};

module.exports = {
  getAllUsers,
  getUserByEmail,
  getUserByID,
  createNewUser,
  updateUserByEmail,
  updateUserPasswordByEmail,
  uploadProfilePhoto,
  deleteUserByID,
  login,
  logout,
};
