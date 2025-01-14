import { Router } from 'express';
import { getAllBlogs, createBlog, likeBlog } from '../controllers/blog.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/multer.middleware.js';

const router = Router();

router.route('/blogs').get(getAllBlogs);
router.route('/create').post(
        verifyToken,
        upload.fields([{ name: 'images', maxCount: 10 }]),
        createBlog,
    );
router.route('/like/:id').post(verifyToken, likeBlog);

export default router;