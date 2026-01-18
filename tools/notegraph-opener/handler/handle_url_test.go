package handler

import (
	"os"
	"path/filepath"
	"testing"
)

func TestHandleURL_OpensExistingFile(t *testing.T) {
	originalOpen := openFileFn
	originalStat := statFn
	t.Cleanup(func() {
		openFileFn = originalOpen
		statFn = originalStat
	})

	var openedPath string
	openFileFn = func(path string) error {
		openedPath = path
		return nil
	}
	statFn = func(string) (os.FileInfo, error) {
		return nil, nil
	}

	rawURL := "notegraph://open?path=C%3A%2FTest%20Folder%2Ffile.pdf"
	if err := HandleURL(rawURL); err != nil {
		t.Fatalf("HandleURL() error = %v", err)
	}

	expected := filepath.FromSlash("C:/Test Folder/file.pdf")
	if openedPath != expected {
		t.Fatalf("opened path = %q, want %q", openedPath, expected)
	}
}
