import { Router } from 'express';
import {
    getUsers,
    registerUser,
    loginUser,
    logOutUser,
    getUserDetails,
    followUser,
    getUserFeed
} from '../controllers/user.controller.js';
import { upload } from '../middlewares/multer.middleware.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.route('/users').post(verifyToken, getUsers);

router
    .route('/register')
    .post(upload.fields([{ name: 'avatar' }]), registerUser);

router.route('/login').post(loginUser);

router.route('/logout').post(verifyToken, logOutUser);

router.route('/isAuthenticated').get(verifyToken, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'User is not authenticated' });
    }

    return res
        .status(200)
        .json({ success: true, message: 'User is authenticated' });
});

router.route('/getUserDetails').get(verifyToken, getUserDetails);
router.route('/followUser').post(verifyToken, followUser);
router.route('/getUserFeed').get(verifyToken, getUserFeed); //not tested yet.

export default router;
