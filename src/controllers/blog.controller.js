import asyncHandler from '../utils/asyncHandler.js';
import Blog from '../models/blog.model.js';
import ApiError from '../utils/apiError.js';
import ApiResponse from '../utils/apiResponse.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import apiError from '../utils/apiError.js';
import langflowClient from '../utils/langflow.js';
import { DataAPIClient } from '@datastax/astra-db-ts';
import OpenAI from 'openai';

// Initialize the client
const client = new DataAPIClient(process.env.ASTRA_DB_TOKEN);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
            author: 'Unknown',
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

const setBlog = asyncHandler(async (req, res) => {
    const id = req.params.id;

    if (!id) {
        return new ApiError(
            400,
            'Please select an article to ask questions on it',
        );
    }

    const blog = await Blog.findById({ _id: id });
    if (!blog) {
        return new ApiError(400, 'No blogs found.');
    }
    const description = blog['description'];
    req.session.blog = description;

    return res.status(200).json(new ApiResponse(200, blog));
});

const askQuestion = asyncHandler(async (req, res) => {
    const { question } = req.body;
    // console.log(req.session.blog)
    if (!req.session.blog) {
        return res
            .status(400)
            .json({
                error: 'No article selected. Please select an article first.',
            });
    }

    const articleContent = req.session.blog;

    // Query OpenAI with article as context
    const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content:
                    "You are an assistant that answers questions strictly based on the provided article. If the answer is not in the article, say 'I don't know'.",
            },
            {
                role: 'user',
                content: `Article: ${articleContent} \n\nQuestion: ${question}`,
            },
        ],
        max_tokens: 300,
    });
    console.log(aiResponse);
    if(!aiResponse){
        return new ApiError(400, 'Error asking question');
    }

    return res.status(200).json(new ApiResponse(200, aiResponse.data.choices[0].message.content));
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
    setBlog,
};
