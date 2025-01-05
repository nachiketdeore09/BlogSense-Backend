import { asyncHandler } from '../utils/asyncHandler.js';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/apiError.js';
import User from '../models/user.model.js';

const verifyToken = asyncHandler(async (req, res, next) => {
    try {
        const token =
            req.cookies?.accessToken ||
            req.header('Authorization')?.replace('Bearer ', '');

        if (!token) return new ApiError(401, 'Unauthorized access');
        const decodedToken = jwt.decode(token, process.env.ACCESS_TOKEN_SECRET);

        const user = await User.findById(decodedToken?._id);

        if (!user) return new ApiError(401, 'Unauthorized access');

        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(404, 'User not found');
    }
});

export { verifyToken };