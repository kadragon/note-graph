package handler

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// HandleURL processes the notegraph:// URL and opens the file.
func HandleURL(rawURL string) error {
	// Parse URL
	path, err := ParseURL(rawURL)
	if err != nil {
		return fmt.Errorf("failed to parse URL: %w", err)
	}

	LogInfo(fmt.Sprintf("Parsed path: %s", path))

	// Validate path
	if err := ValidatePath(path); err != nil {
		return fmt.Errorf("path validation failed: %w", err)
	}

	// Normalize path separators for Windows
	path = filepath.FromSlash(path)

	// Check if file exists
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return fmt.Errorf("file not found: %s", path)
	}

	LogInfo(fmt.Sprintf("Opening file: %s", path))

	// Open file with default application
	if err := openFile(path); err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}

	LogInfo("File opened successfully")
	return nil
}

// openFile opens a file with the default Windows application.
// Uses "cmd /c start" which is the standard way to open files on Windows.
func openFile(path string) error {
	// Quote the path to handle spaces and cmd metacharacters (&, |, ^, <, >)
	// Without quotes, filenames like "R&D.pdf" would be misinterpreted by cmd
	quotedPath := `"` + path + `"`
	cmd := exec.Command("cmd", "/c", "start", "", quotedPath)

	// Hide the command window
	cmd.Stdout = nil
	cmd.Stderr = nil

	return cmd.Run()
}

// NormalizePath converts forward slashes to backslashes and cleans the path.
func NormalizePath(path string) string {
	// Convert forward slashes to backslashes for Windows
	path = strings.ReplaceAll(path, "/", "\\")
	return filepath.Clean(path)
}
