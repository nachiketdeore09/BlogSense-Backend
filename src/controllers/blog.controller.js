import asyncHandler from '../utils/asyncHandler.js';
import Blog from '../models/blog.model.js';
import ApiError from '../utils/apiError.js';
import ApiResponse from '../utils/apiResponse.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import apiError from '../utils/apiError.js';
import langflowClient from '../utils/langflow.js';
import { DataAPIClient } from '@datastax/astra-db-ts';

// Initialize the client
const client = new DataAPIClient(process.env.ASTRA_DB_TOKEN);

const db = client.db(
    'https://d178fedd-0a5d-4640-9067-af8f29002fb9-us-east-2.apps.astra.datastax.com',
);

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

    const document = {
        $vectorize: description,
        title,
        images: imageURLs,
        owner: req.user._id,
        metadata: {
            category: 'General', // Add default metadata if missing
            author:  'Unknown',
            created_at: new Date().toISOString(),
        },
    };

    const blog = db.collection('blog');
    const result = await blog.insertOne(document);

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

    return res
        .status(201)
        .json(new ApiResponse(201, 'Blog created', createdBlog));
});

const likeBlog = asyncHandler(async (req, res) => {
    const id = req.params.id || req.body.id;

    if (!id) {
        throw new ApiError(400, 'Blog ID is required'); // Handle missing ID
    }

    const blog = await Blog.findById(id);
    if (!blog) {
        return new ApiError(404, 'Blog not found');
    }

    if (blog.likes.includes(req.user._id)) {
        return new ApiError(400, 'You have already liked this blog');
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
    return res
        .status(200)
        .json(new ApiResponse(200, 'Blog deleted', deleteRes));
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

const askQuestion = asyncHandler(async (req, res) => {
    const { question } = req.body;
    // initiate session with langflow
    const flowId = process.env.FLOWID;
    const langflowId = process.env.LANGFLOW_ID;
    if (!question || !flowId || !langflowId) {
        return res.status(400).json({
            error: 'Missing required fields: message, flowId, or langflowId',
        });
    }

    try {
        const tweaks = {
            'ChatInput-ivyVt': {},
            'Prompt-lpeoJ': {},
            'ChatOutput-eV0ob': {},
            'OpenAIModel-SzTnW': {},
        };

        const data = await langflowClient.runFlow(
            flowId,
            langflowId,
            question,
            'chat', // inputType
            'chat', // outputTypedata
            tweaks,
        );
        // console.log(data);
        const outputs =
            data?.outputs?.[0]?.outputs?.[0]?.results?.message?.text;

        res.status(200).json(
            new ApiResponse(200, outputs, 'Answer to the question'),
        );
    } catch (error) {
        console.error('Error asking question:', error);
        res.status(500).json({
            error: 'Error asking question',
        });
    }
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
};
