import asyncHandler from '../utils/asyncHandler.js';
import Blog from '../models/blog.model.js';
import ApiError from '../utils/apiError.js';
import ApiResponse from '../utils/apiResponse.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';

const getAllBlogs = asyncHandler(async (req, res) => {
    const blogs = await Blog.find();
    if (!blogs) {
        return new ApiError(404, 'No blogs found');
    }
    return res.status(200).json(new ApiResponse(200, 'Blogs found', blogs));
});

const createBlog = asyncHandler(async (req, res) => {
    const { title, description } = req.body;
    const local_images = ''; //req.files.map((file) => file.path);
    if (!title || !description) {
        return new ApiError(400, 'Title and description are required');
    }
    // Upload images to cloudinary
    // const imageURLs = [];
    // if (local_images.length > 0) {
    //     for (const image of local_images) {
    //         const uploadedImage = await uploadOnCloudinary(image);
    //         imageURLs.push(uploadedImage.secure_url);
    //     }
    // }
    const blog = await Blog.create({
        title,
        description,
        images: '',
        owner: req.user._id,
    });

    const createdBlog = await Blog.findById(blog._id).populate(
        'owner',
        'username email',
    );
    if (!createdBlog) {
        return new ApiError(500, 'Error creating blog');
    }

    return res
        .status(201)
        .json(new ApiResponse(201, 'Blog created', createdBlog));
});

const likeBlog = asyncHandler(async (req, res) => {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
        return new ApiError(404, 'Blog not found');
    }

    if (blog.likes.includes(req.user._id)) {
        return new ApiError(400, 'You have already liked this blog');
    }

    blog.likes.push(req.user._id);
    await blog.save();

    return res.status(200).json(new ApiResponse(200, 'Blog liked', blog));
})

const commentBlog = asyncHandler(async (req, res) => {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
        return new ApiError(404, 'Blog not found');
    }

    if (blog.comments.includes(req.user._id)) {
        return new ApiError(400, 'You have already commented on this blog');
    }

    blog.comments.push(req.user._id);
    await blog.save();

    return res.status(200).json(new ApiResponse(200, 'Blog commented', blog));
});

export { getAllBlogs, createBlog, likeBlog };
