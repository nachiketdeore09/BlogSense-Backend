import { Router } from 'express';
import { getAllBlogs, createBlog, likeBlog, commentBlog, deleteBlog, updateBlog, getUserBlogs, askQuestion } from '../controllers/blog.controller.js';
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
router.route('/comment').post(verifyToken, commentBlog);
router.route('/delete/:id').delete(verifyToken, deleteBlog);
router.route('/update/:id').put(verifyToken, updateBlog);
router.route('/user').get(verifyToken, getUserBlogs);
router.route('/ask').post(verifyToken, askQuestion);
// router.route('/set-blog/:id').post(verifyToken, setBlog)
router.route('/ask').post(verifyToken, askQuestion);

export default router;