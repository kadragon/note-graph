package handler

import (
	"errors"
	"path/filepath"
	"strings"
)

var (
	ErrEmptyPathValidation = errors.New("path is empty")
	ErrRelativePath        = errors.New("relative path not allowed, must be absolute")
	ErrPathTraversal       = errors.New("path traversal detected")
	ErrBlockedExtension    = errors.New("file extension is blocked for security")
	ErrUnknownExtension    = errors.New("unknown file extension not allowed")
)

// Allowed file extensions (whitelist)
var allowedExtensions = map[string]bool{
	".pdf":  true,
	".docx": true,
	".doc":  true,
	".xlsx": true,
	".xls":  true,
	".pptx": true,
	".ppt":  true,
	".hwp":  true,
	".hwpx": true,
	".txt":  true,
	".rtf":  true,
	".png":  true,
	".jpg":  true,
	".jpeg": true,
	".gif":  true,
	".bmp":  true,
	".webp": true,
	".svg":  true,
}

// Blocked file extensions (blacklist for extra safety)
var blockedExtensions = map[string]bool{
	".exe": true,
	".bat": true,
	".cmd": true,
	".ps1": true,
	".vbs": true,
	".js":  true,
	".msi": true,
	".com": true,
	".scr": true,
	".pif": true,
	".reg": true,
}

// ValidatePath validates the file path for security.
func ValidatePath(path string) error {
	if path == "" {
		return ErrEmptyPathValidation
	}

	// Check for path traversal attacks
	if strings.Contains(path, "..") {
		return ErrPathTraversal
	}

	// Check for absolute path (Windows)
	// Must start with drive letter like C:/ or C:\
	if len(path) < 3 || path[1] != ':' || (path[2] != '/' && path[2] != '\\') {
		return ErrRelativePath
	}

	// Get file extension (case insensitive)
	ext := strings.ToLower(filepath.Ext(path))

	// Check blocked extensions first
	if blockedExtensions[ext] {
		return ErrBlockedExtension
	}

	// Check allowed extensions
	if !allowedExtensions[ext] {
		return ErrUnknownExtension
	}

	return nil
}
