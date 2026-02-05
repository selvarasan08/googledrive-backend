const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'File/Folder name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['file', 'folder'],
      required: true,
    },
    mimeType: {
      type: String,
      default: null,
    },
    size: {
      type: Number,
      default: 0, // in bytes
    },
    path: {
      type: String,
      required: true,
    },
    s3Key: {
      type: String,
      default: null, // Only for files, not folders
    },
    s3Url: {
      type: String,
      default: null,
    },
    parentFolder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      default: null, // null means root directory
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isStarred: {
      type: Boolean,
      default: false,
    },
    isTrashed: {
      type: Boolean,
      default: false,
    },
    trashedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
fileSchema.index({ owner: 1, parentFolder: 1 });
fileSchema.index({ owner: 1, isTrashed: 1 });
fileSchema.index({ owner: 1, path: 1 });

// Method to get file extension
fileSchema.methods.getExtension = function () {
  if (this.type === 'folder') return null;
  const parts = this.name.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : null;
};

// Method to check if file is an image
fileSchema.methods.isImage = function () {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
  const ext = this.getExtension();
  return ext && imageExtensions.includes(ext);
};

// Method to format file size
fileSchema.methods.getFormattedSize = function () {
  const bytes = this.size;
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const File = mongoose.model('File', fileSchema);

module.exports = File;