import User from '../models/user.model.js';
import Blog from '../models/blog.model.js';
import apiError from '../utils/apiError.js';
import ApiError from '../utils/apiError.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findOne({ _id: userId });
        if (!user) {
            throw new ApiError(404, 'User not found');
        }
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();
        // console.log({ accessToken, refreshToken });
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, error.message);
    }
};

//to get all the users resigtered in the system
const getUsers = asyncHandler(async (req, res) => {

    const users = await User.find().select('-password -refreshToken');
    if (!users) {
        throw new ApiError(404, 'No users found');
    }
    return res.status(200).json(new ApiResponse(200, 'Users found', users));
});

const getUserDetails = asyncHandler(async (req, res) => {
    const { user_id } = req.body || req.params;

    if (!user_id) {
        throw new apiError("please pass a valid Id");
    }

    const user = await User.findById(user_id);
    console.log("done")
    if (!user) {
        throw new apiError("User not found");
    }
    return res
        .status(201)
        .json(new ApiResponse(201, 'User fetched', user));
})

const registerUser = asyncHandler(async (req, res) => {
    const { username, password, fullname, email, gender } = req.body;
    if (!username || !password || !fullname) {
        throw new ApiError(400, 'Please fill in all fields');
    }
    User.findOne({ $or: [{ username: username, email: email }] }).then(
        (user) => {
            if (user) {
                throw new ApiError(400, 'Username already exists');
            }
        },
    );

    let avatarLocalPath = null;
    if (req.files && req.files.avatar && req.files.avatar.length > 0) {
        avatarLocalPath = req.files.avatar[0]?.path;
    }

    if (avatarLocalPath == null) {
        throw new ApiError(400, 'Please provide an avatar !');
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar) {
        throw new ApiError(500, 'Error uploading avatar');
    }

    const user = await User.create({
        username,
        password,
        fullname,
        email,
        gneder: gender?.toLowerCase() || 'other',
        avatar,
    });

    const newUser = await User
        .findOne({ _id: user._id })
        .select('-password -refreshToken');

    if (!newUser) {
        throw new ApiError(500, 'Error creating user');
    }

    return res
        .status(201)
        .json(new ApiResponse(201, 'User created successfully', newUser));
});

const loginUser = asyncHandler(async (req, res) => {
    const { username, password, email } = req.body;
    if (!username && !email) {
        throw new ApiError(400, 'Please provide a username or email');
    }
    if (!password) {
        throw new ApiError(400, 'Please provide a password');
    }

    const user = await User.findOne({
        $or: [{ username: username }, { email: email }],
    });
    if (!user) {
        throw new ApiError(404, 'User not found');
    }
    const isMatch = await user.isPasswordCorrect(password);
    if (!isMatch) {
        throw new ApiError(401, 'Invalid credentials');
    }
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        user._id,
    );
    // console.log(accessToken, refreshToken);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    const newUser = await User.findById({ _id: user._id }).select(
        '-password',
    );
    if (!newUser) {
        throw new ApiError(500, 'Error logging in user');
    }
    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .cookie('refreshToken', refreshToken, options)
        .cookie('accessToken', accessToken, options)
        .json(new ApiResponse(200, 'User logged in successfully', { user: newUser, accessToken, refreshToken }));
});

const logOutUser = asyncHandler(async (req, res) => {
    // console.log(req.user);
    if (!req.user) {
        throw new ApiError(401, 'Unauthorized');
    }
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: '',
            },
        },
        {
            new: true,
            select: '-password ',
        },
    );

    const options = {
        httpOnly: true,
        secure: true,
        sameSite: 'None', // Use the same setting as when setting the cookies
        path: '/', // Default is '/' if not explicitly set
    };

    return res
        .status(200)
        .clearCookie('accessToken', options)
        .clearCookie('refreshToken', options)
        .json(new ApiResponse(200, {}, 'User logged out successfully'));
});

const followUser = asyncHandler(async (req, res) => {
    const { wantToFollowId } = req.body;
    if (!wantToFollowId) {
        throw new apiError("need to be valid user to follow");
    }

    const wantToFollowUser = await User.findById(wantToFollowId);
    if (!wantToFollowUser) {
        throw new apiError("User not found");
    }
    if (req.user.following.includes(wantToFollowUser._id)) {
        throw new ApiError(400, "Already following this user");
    }

    req.user.following.push(wantToFollowUser._id);
    wantToFollowUser.followers.push(req.user._id);

    await req.user.save({ validateBeforeSave: false });
    await wantToFollowUser.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, { wantToFollowUser }, "successfully following"));
})

const getUserFeed = asyncHandler(async (req, res) => {

    if (!req.user) {
        throw new ApiError(401, "Unauthorized");
    }

    // Get list of users this user follows
    const followingIds = req.user.following;

    if (!followingIds || followingIds.length === 0) {
        return res.status(200).json(new ApiResponse(200, [], "No following, empty feed"));
    }

    // Fetch blogs by followed users
    const feedBlogs = await Blog.find({ owner: { $in: followingIds } })
        .populate("owner", "username fullname avatar") // populate owner details
        .sort({ createdAt: -1 }); // latest first

    return res.status(200).json(
        new ApiResponse(200, feedBlogs, "Feed fetched successfully")
    );
});

export {
    getUsers,
    registerUser,
    loginUser,
    logOutUser,
    getUserDetails,
    followUser,
    getUserFeed
};

// store the blogs created by a user to its model.
// write a contorller to get all blogs created by any user.
