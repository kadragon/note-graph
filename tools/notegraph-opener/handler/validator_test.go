package handler

import (
	"testing"
)

func TestValidatePath_AllowedExtensions(t *testing.T) {
	allowedPaths := []string{
		"C:/test.pdf",
		"C:/test.PDF",
		"C:/docs/file.docx",
		"C:/docs/file.xlsx",
		"C:/docs/file.hwp",
		"C:/docs/file.txt",
		"C:/images/photo.png",
		"C:/images/photo.jpg",
		"C:/images/photo.jpeg",
		"C:/images/photo.gif",
		"C:/docs/file.pptx",
	}

	for _, path := range allowedPaths {
		t.Run(path, func(t *testing.T) {
			err := ValidatePath(path)
			if err != nil {
				t.Errorf("ValidatePath(%s) should be allowed, got error: %v", path, err)
			}
		})
	}
}

func TestValidatePath_BlockedExtensions(t *testing.T) {
	blockedPaths := []string{
		"C:/malware.exe",
		"C:/script.bat",
		"C:/script.cmd",
		"C:/script.ps1",
		"C:/script.vbs",
		"C:/script.js",
		"C:/installer.msi",
		"C:/script.EXE",
		"C:/script.BAT",
	}

	for _, path := range blockedPaths {
		t.Run(path, func(t *testing.T) {
			err := ValidatePath(path)
			if err == nil {
				t.Errorf("ValidatePath(%s) should be blocked", path)
			}
			if err != ErrBlockedExtension {
				t.Errorf("ValidatePath(%s) expected ErrBlockedExtension, got %v", path, err)
			}
		})
	}
}

func TestValidatePath_PathTraversal(t *testing.T) {
	dangerousPaths := []string{
		"C:/docs/../../../etc/passwd",
		"C:/docs/..\\..\\windows\\system32",
		"..\\test.pdf",
		"../test.pdf",
		"C:/docs/sub/../../../test.pdf",
	}

	for _, path := range dangerousPaths {
		t.Run(path, func(t *testing.T) {
			err := ValidatePath(path)
			if err == nil {
				t.Errorf("ValidatePath(%s) should be blocked (path traversal)", path)
			}
			if err != ErrPathTraversal {
				t.Errorf("ValidatePath(%s) expected ErrPathTraversal, got %v", path, err)
			}
		})
	}
}

func TestValidatePath_InvalidPath(t *testing.T) {
	invalidPaths := []string{
		"",
		"relative/path.pdf",
		"./test.pdf",
	}

	for _, path := range invalidPaths {
		t.Run(path, func(t *testing.T) {
			err := ValidatePath(path)
			if err == nil {
				t.Errorf("ValidatePath(%s) should be invalid", path)
			}
		})
	}
}

func TestValidatePath_UnknownExtension(t *testing.T) {
	// Unknown extensions should be blocked by default for safety
	unknownPaths := []string{
		"C:/file.xyz",
		"C:/file.unknown",
		"C:/file",
	}

	for _, path := range unknownPaths {
		t.Run(path, func(t *testing.T) {
			err := ValidatePath(path)
			if err == nil {
				t.Errorf("ValidatePath(%s) should be blocked (unknown extension)", path)
			}
		})
	}
}
