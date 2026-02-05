const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const s3Client = require('../config/aws');
const File = require('../models/File');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

/**
 * @desc    Get all files and folders for logged-in user
 * @route   GET /api/files
 * @access  Private
 */
const getFiles = async (req, res) => {
  try {
    const { folderId, search } = req.query;
    
    let query = {
      owner: req.user._id,
      isTrashed: false,
    };

    // Filter by parent folder
    if (folderId) {
      query.parentFolder = folderId;
    } else {
      query.parentFolder = null; // Root directory
    }

    // Search functionality
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const files = await File.find(query)
      .sort({ type: -1, createdAt: -1 }) // Folders first, then by date
      .populate('parentFolder', 'name');

    res.status(200).json({
      success: true,
      count: files.length,
      data: files,
    });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching files',
      error: error.message,
    });
  }
};

/**
 * @desc    Get specific file/folder details
 * @route   GET /api/files/:id
 * @access  Private
 */
const getFileById = async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      owner: req.user._id,
    }).populate('parentFolder', 'name');

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    res.status(200).json({
      success: true,
      data: file,
    });
  } catch (error) {
    console.error('Get file by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching file',
      error: error.message,
    });
  }
};

/**
 * @desc    Create new folder
 * @route   POST /api/files/folder
 * @access  Private
 */
const createFolder = async (req, res) => {
  try {
    const { name, parentFolder } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Folder name is required',
      });
    }

    // Build folder path
    let folderPath = '/';
    if (parentFolder) {
      const parent = await File.findOne({
        _id: parentFolder,
        owner: req.user._id,
        type: 'folder',
      });

      if (!parent) {
        return res.status(404).json({
          success: false,
          message: 'Parent folder not found',
        });
      }

      folderPath = `${parent.path}${parent.name}/`;
    }

    // Check if folder already exists in same location
    const existingFolder = await File.findOne({
      name,
      parentFolder: parentFolder || null,
      owner: req.user._id,
      type: 'folder',
      isTrashed: false,
    });

    if (existingFolder) {
      return res.status(400).json({
        success: false,
        message: 'A folder with this name already exists in this location',
      });
    }

    // Create folder
    const folder = await File.create({
      name,
      type: 'folder',
      path: folderPath,
      parentFolder: parentFolder || null,
      owner: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: 'Folder created successfully',
      data: folder,
    });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating folder',
      error: error.message,
    });
  }
};

/**
 * @desc    Upload file to S3
 * @route   POST /api/files/upload
 * @access  Private
 */
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const { parentFolder } = req.body;

    // Check user storage limit
    const user = await User.findById(req.user._id);
    if (user.storageUsed + req.file.size > user.storageLimit) {
      return res.status(400).json({
        success: false,
        message: 'Storage limit exceeded',
      });
    }

    // Build file path
    let filePath = '/';
    if (parentFolder) {
      const parent = await File.findOne({
        _id: parentFolder,
        owner: req.user._id,
        type: 'folder',
      });

      if (!parent) {
        return res.status(404).json({
          success: false,
          message: 'Parent folder not found',
        });
      }

      filePath = `${parent.path}${parent.name}/`;
    }

    // Generate unique S3 key
    const fileExtension = path.extname(req.file.originalname);
    const fileName = path.basename(req.file.originalname, fileExtension);
    const s3Key = `${req.user._id}/${uuidv4()}-${fileName}${fileExtension}`;

    // Upload to S3
    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: s3Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    try {
      await s3Client.send(new PutObjectCommand(uploadParams));
    } catch (s3Error) {
      console.error('S3 upload error:', s3Error);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload file to S3',
        error: s3Error.message,
      });
    }

    // Create file record in database
    const file = await File.create({
      name: req.file.originalname,
      type: 'file',
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: filePath,
      s3Key: s3Key,
      parentFolder: parentFolder || null,
      owner: req.user._id,
    });

    // Update user storage
    user.storageUsed += req.file.size;
    await user.save();

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: file,
    });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading file',
      error: error.message,
    });
  }
};

/**
 * @desc    Download file from S3
 * @route   GET /api/files/download/:id
 * @access  Private
 */
const downloadFile = async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      owner: req.user._id,
      type: 'file',
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    // Generate pre-signed URL for download
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: file.s3Key,
      ResponseContentDisposition: `attachment; filename="${file.name}"`,
    });

    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour

    res.status(200).json({
      success: true,
      data: {
        downloadUrl,
        fileName: file.name,
        fileSize: file.size,
      },
    });
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while downloading file',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete file/folder
 * @route   DELETE /api/files/:id
 * @access  Private
 */
const deleteFile = async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File/Folder not found',
      });
    }

    // If it's a folder, delete all contents recursively
    if (file.type === 'folder') {
      await deleteFolderContents(file._id, req.user._id);
    }

    // If it's a file, delete from S3
    if (file.type === 'file' && file.s3Key) {
      try {
        const deleteParams = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: file.s3Key,
        };
        await s3Client.send(new DeleteObjectCommand(deleteParams));

        // Update user storage
        const user = await User.findById(req.user._id);
        user.storageUsed = Math.max(0, user.storageUsed - file.size);
        await user.save();
      } catch (s3Error) {
        console.error('S3 delete error:', s3Error);
        // Continue with database deletion even if S3 fails
      }
    }

    // Delete file/folder from database
    await File.findByIdAndDelete(file._id);

    res.status(200).json({
      success: true,
      message: `${file.type === 'folder' ? 'Folder' : 'File'} deleted successfully`,
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting file',
      error: error.message,
    });
  }
};

/**
 * Helper function to recursively delete folder contents
 */
const deleteFolderContents = async (folderId, userId) => {
  const contents = await File.find({
    parentFolder: folderId,
    owner: userId,
  });

  for (const item of contents) {
    if (item.type === 'folder') {
      await deleteFolderContents(item._id, userId);
    } else if (item.type === 'file' && item.s3Key) {
      // Delete from S3
      try {
        const deleteParams = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: item.s3Key,
        };
        await s3Client.send(new DeleteObjectCommand(deleteParams));

        // Update user storage
        const user = await User.findById(userId);
        user.storageUsed = Math.max(0, user.storageUsed - item.size);
        await user.save();
      } catch (s3Error) {
        console.error('S3 delete error:', s3Error);
      }
    }
    await File.findByIdAndDelete(item._id);
  }
};

/**
 * @desc    Update file/folder (rename)
 * @route   PUT /api/files/:id
 * @access  Private
 */
const updateFile = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required',
      });
    }

    const file = await File.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File/Folder not found',
      });
    }

    // Check if name already exists in same location
    const existing = await File.findOne({
      name,
      parentFolder: file.parentFolder,
      owner: req.user._id,
      type: file.type,
      _id: { $ne: file._id },
      isTrashed: false,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A file/folder with this name already exists in this location',
      });
    }

    file.name = name;
    await file.save();

    res.status(200).json({
      success: true,
      message: `${file.type === 'folder' ? 'Folder' : 'File'} updated successfully`,
      data: file,
    });
  } catch (error) {
    console.error('Update file error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating file',
      error: error.message,
    });
  }
};

/**
 * @desc    Toggle starred status of file/folder
 * @route   PATCH /api/files/:id/starred
 * @access  Private
 */
const toggleStarred = async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File/Folder not found',
      });
    }

    // Toggle the starred status
    file.isStarred = !file.isStarred;
    await file.save();

    res.status(200).json({
      success: true,
      data: file,
      message: file.isStarred ? 'Added to starred' : 'Removed from starred',
    });
  } catch (error) {
    console.error('Toggle starred error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while toggling starred',
      error: error.message,
    });
  }
};

/**
 * @desc    Move file/folder to another folder
 * @route   PATCH /api/files/:id/move
 * @access  Private
 */
const moveFile = async (req, res) => {
  try {
    const { targetFolderId } = req.body;
    const fileId = req.params.id;

    // Find the file/folder to move
    const file = await File.findOne({
      _id: fileId,
      owner: req.user._id,
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File/Folder not found',
      });
    }

    // Validate target folder (if not moving to root)
    let targetFolder = null;
    let newPath = '/';

    if (targetFolderId) {
      targetFolder = await File.findOne({
        _id: targetFolderId,
        owner: req.user._id,
        type: 'folder',
        isTrashed: false,
      });

      if (!targetFolder) {
        return res.status(404).json({
          success: false,
          message: 'Target folder not found',
        });
      }

      // Prevent moving a folder into itself or its own subfolder
      if (file.type === 'folder') {
        const isDescendant = await checkIfDescendant(targetFolderId, fileId);
        if (fileId === targetFolderId || isDescendant) {
          return res.status(400).json({
            success: false,
            message: 'Cannot move a folder into itself or its subfolder',
          });
        }
      }

      newPath = `${targetFolder.path}${targetFolder.name}/`;
    }

    // Check if file/folder with same name exists in target location
    const existing = await File.findOne({
      name: file.name,
      parentFolder: targetFolderId || null,
      owner: req.user._id,
      type: file.type,
      _id: { $ne: file._id },
      isTrashed: false,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A file/folder with this name already exists in the target location',
      });
    }

    // Update file/folder parent and path
    file.parentFolder = targetFolderId || null;
    file.path = newPath;
    await file.save();

    // If it's a folder, update paths of all children recursively
    if (file.type === 'folder') {
      await updateChildrenPaths(file._id, newPath + file.name + '/');
    }

    res.status(200).json({
      success: true,
      message: `${file.type === 'folder' ? 'Folder' : 'File'} moved successfully`,
      data: file,
    });
  } catch (error) {
    console.error('Move file error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while moving file',
      error: error.message,
    });
  }
};

/**
 * Helper function to check if targetId is a descendant of folderId
 */
const checkIfDescendant = async (targetId, folderId) => {
  let current = await File.findById(targetId);
  
  while (current && current.parentFolder) {
    if (current.parentFolder.toString() === folderId.toString()) {
      return true;
    }
    current = await File.findById(current.parentFolder);
  }
  
  return false;
};

/**
 * Helper function to recursively update paths of all children
 */
const updateChildrenPaths = async (folderId, newParentPath) => {
  const children = await File.find({ parentFolder: folderId });

  for (const child of children) {
    child.path = newParentPath;
    await child.save();

    if (child.type === 'folder') {
      await updateChildrenPaths(child._id, newParentPath + child.name + '/');
    }
  }
};

module.exports = {
  getFiles,
  getFileById,
  createFolder,
  uploadFile,
  downloadFile,
  deleteFile,
  updateFile,
  toggleStarred,
  moveFile, // NEW: Export moveFile function
};