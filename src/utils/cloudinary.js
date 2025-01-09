import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs'; // Node.js File system for file operations
import ApiError from './apiError';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localPath) => {
    try {
        if (!localPath) {
            throw new ApiError(401, "Local path is required")
        }
        const response = await cloudinary.uploader.upload(
            localPath,
            {
                resource_type: 'auto',
            },
            (error, result) => {
                if (error) {
                    console.error(error);
                } else {
                    console.log(result);
                }
            },
        );
        // console.log("File uploaded succesfully, ",response.url);
        fs.unlinkSync(localPath); // remove locally saved file after uploading
        return response.url;
    } catch (error) {
        fs.unlinkSync(localPath); // remove locally saved file
        return error;
    }
};

const deleteFromCloudinary = async (publicUrl) => {
    try {
        if (!publicUrl) {
            throw new Error('Public URL is required');
        }
        const response = await cloudinary.uploader.destroy(
            publicUrl,
            (error, result) => {
                if (error) {
                    console.error(error);
                } else {
                    console.log('Deleted succesfully ', result);
                }
            },
        );
        return response;
    } catch (error) {
        return error;
    }
};

export { uploadOnCloudinary, deleteFromCloudinary };
