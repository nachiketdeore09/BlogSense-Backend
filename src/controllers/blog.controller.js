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
    if (!title || !description) {
        return new ApiError(400, 'Title and description are required');
    }

    // Upload images to cloudinary
    const imageURLs = [];
    if (req.files && req.files.images.length > 0) {
        const local_images = req.files.images;
        if (local_images.length > 0) {
            for (const image of local_images) {
                const uploadedImage = await uploadOnCloudinary(image.path);
                if (!uploadedImage) {
                    return new ApiError(500, 'Error uploading image');
                }
                imageURLs.push(uploadedImage);
            }
        }
    }
    const blog = await Blog.create({
        title,
        description,
        images: imageURLs,
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
    const id = req.params.id || req.body.id;
    
    if (!id) {
        throw new ApiError(400, 'Blog ID is required'); // Handle missing ID
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, 'Invalid Blog ID'); // Validate ID format
    }

    const blog = await Blog.findById(id);
    if (!blog) {
        return new ApiError(404, 'Blog not found');
    }

    if (blog.likes.includes(req.user._id)) {
        return new ApiError(400, 'You have already liked this blog');
    }

    blog.likes.push(req.user._id);
    await blog.save();

    return res.status(200).json(new ApiResponse(200, 'Blog liked', blog));
});

const commentBlog = asyncHandler(async (req, res) => {
    if (!req.user) {
        return new ApiError(401, 'Unauthorized');
    }
    const id = req.params.id || req.body.id;

    if (!id) {
        throw new ApiError(400, 'Blog ID is required'); // Handle missing ID
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, 'Invalid Blog ID'); // Validate ID format
    }

    const blog = await Blog.findById(id);
    if (!blog) {
        return new ApiError(404, 'Blog not found');
    }

    const { comment } = req.body;

    blog.comments.push({
        user: req.user._id,
        comment,
    });
    await blog.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, 'Blog commented', blog));
});

export { getAllBlogs, createBlog, likeBlog, commentBlog };
