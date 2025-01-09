import { Router } from 'express';
import {
    getUsers,
    registerUser,
    loginUser,
    logOutUser,
} from '../controllers/user.controller.js';
import { upload } from '../middlewares/multer.middleware.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.route('/users').post(verifyToken,getUsers);

router.route('/register').post(upload.fields([{name: "avatar"}]), registerUser);

router.route('/login').post(loginUser);

router.route('/logout').post(verifyToken, logOutUser);

export default router;