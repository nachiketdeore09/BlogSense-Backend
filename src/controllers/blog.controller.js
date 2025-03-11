import asyncHandler from '../utils/asyncHandler.js';
import Blog from '../models/blog.model.js';
import ApiError from '../utils/apiError.js';
import ApiResponse from '../utils/apiResponse.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import apiError from '../utils/apiError.js';
import { index, generateEmbedding } from '../db/pinecone.js';
import mongoose from 'mongoose';
import generateAnswer from '../utils/generateAnswer.js';

const getAllBlogs = asyncHandler(async (req, res) => {
    // Get only title and description
    const blogs = await Blog.find().select('title description');
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

    const blogOnMongo = await Blog.create({
        title,
        description,
        images: imageURLs,
        owner: req.user._id,
    });

    const createdBlog = await Blog.findById(blogOnMongo._id).populate(
        'owner',
        'username email',
    );

    if (!createdBlog) {
        return new ApiError(500, 'Error creating blog');
    }

    const embedding = await generateEmbedding(`${title}. ${description}`);

    await index.upsert([
        {
            id: createdBlog._id,
            values: embedding,
            metadata: {
                title: title,
                description: description,
            },
        },
    ]);

    return res
        .status(201)
        .json(new ApiResponse(201, 'Blog created', createdBlog));
});

const likeBlog = asyncHandler(async (req, res) => {
    const id = req.params.id || req.body.id;

    if (!id) {
        throw new ApiError(400, 'Blog ID is required');
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, 'Invalid blog ID format');
    }

    const blog = await Blog.findById(id);


    if (!blog) {
        throw new ApiError(404, 'Blog not found');
    }

    if (blog.likes.includes(req.user._id)) {
        // remove the like
        blog.likes = blog.likes.filter((like) => like.toString() !== req.user._id.toString());
        await blog.save({ validateBeforeSave: false });
        return res.status(200).json(new ApiResponse(200, 'Blog unliked', blog));
    }

    blog.likes.push(req.user._id);
    await blog.save({ validateBeforeSave: false });
    return res.status(200).json(new ApiResponse(200, 'Blog liked', blog));
});

const commentBlog = asyncHandler(async (req, res) => {
    if (!req.user) {
        return new ApiError(401, 'Unauthorized');
    }

    const id = req.params.id || req.query.id || req.body.id;

    if (!id) {
        throw new ApiError(400, 'Blog ID is required'); // Handle missing ID
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

const updateBlog = asyncHandler(async (req, res) => {
    // Update blog code here
    const id = req.params.id || req.query.id || req.body.id;
    const { title, description } = req.body;

    if (!title && !description) {
        throw new apiError(400, 'Title or description is required');
    }

    if (!id) {
        throw new ApiError(400, 'Blog ID is required');
    }
    const blog = await Blog.findById(id);
    if (!blog) {
        throw new ApiError(404, 'Blog not found');
    }
    if (blog.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, 'Unauthorized access');
    }
    if (title) {
        blog.title = title;
    }
    if (description) {
        blog.description = description || blog.description;
    }

    // Delete the old blog from Pinecone
    // await index.delete({ id: blog._id });
    const embedding = await generateEmbedding(description);

    await index.update({
        id: blog._id,
        values: embedding,
        metadata: {
            title: title,
            description: description,
        },
    });

    await blog.save({ validateBeforeSave: false });
    return res.status(200).json(new ApiResponse(200, 'Blog updated', blog));
});

const deleteBlog = asyncHandler(async (req, res) => {
    const id = req.params.id || req.query.id || req.body.id;
    if (!id) {
        throw new ApiError(400, 'Blog ID is required');
    }
    const blog = await Blog.findById(id);
    if (!blog) {
        return new ApiError(404, 'Blog not found');
    }

    if (blog.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, 'Unauthorized access');
    }

    const deleteRes = await Blog.findByIdAndDelete(id);
    if (!deleteRes) {
        return new ApiError(500, 'Error deleting blog');
    }

    const r = await index.deleteOne('67acba7e9518f7ac7ef203db');

    return res.status(200).json(new ApiResponse(200, 'Blog deleted', r));
});

//get user's all blogs
const getUserBlogs = asyncHandler(async (req, res) => {
    if (!req.user) {
        return new ApiError(401, 'Unauthorized');
    }
    const blogs = await Blog.find({ owner: req.user._id });
    if (!blogs) {
        return new ApiError(404, 'No blogs found');
    }
    return res.status(200).json(new ApiResponse(200, 'Blogs found', blogs));
});

const getContext = async (question) => {
    const embedding = await generateEmbedding(question);
    const queryResult = await index.query({
        vector: embedding,
        topK: 5, // Retrieve top 5 most relevant blogs
        includeMetadata: true,
    });
    if (!queryResult) {
        return new ApiError(400, 'Error getting context');
    }

    const context = queryResult.matches.map(
        (match) => match.metadata.description,
    );
    if (!context) {
        return new ApiError(400, 'Error getting context');
    }
    return context.join('\n');
};

const askQuestion = asyncHandler(async (req, res) => {
    const { question } = req.body;

    const context = await getContext(question);

    const aiResponse = await generateAnswer(context, question);
    if (!aiResponse) {
        return new ApiError(400, 'Error asking question');
    }

    return res.status(200).json(new ApiResponse(200, 'aiResponse'));
});

export {
    getAllBlogs,
    createBlog,
    likeBlog,
    commentBlog,
    updateBlog,
    deleteBlog,
    getUserBlogs,
    askQuestion,
    getContext,
};
