package handler

import (
	"testing"
)

func TestParseURL_ValidURL(t *testing.T) {
	tests := []struct {
		name     string
		url      string
		expected string
	}{
		{
			name:     "simple path",
			url:      "notegraph://open?path=C%3A%2Ftest.txt",
			expected: "C:/test.txt",
		},
		{
			name:     "path with spaces",
			url:      "notegraph://open?path=C%3A%2FGoogle%20Drive%2Ffile.pdf",
			expected: "C:/Google Drive/file.pdf",
		},
		{
			name:     "korean filename",
			url:      "notegraph://open?path=C%3A%2F%EB%AC%B8%EC%84%9C.pdf",
			expected: "C:/문서.pdf",
		},
		{
			name:     "deep path",
			url:      "notegraph://open?path=C%3A%2FUsers%2Fuser%2FGoogle%20Drive%2FWORK-001%2Fdocument.pdf",
			expected: "C:/Users/user/Google Drive/WORK-001/document.pdf",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseURL(tt.url)
			if err != nil {
				t.Errorf("ParseURL() error = %v", err)
				return
			}
			if result != tt.expected {
				t.Errorf("ParseURL() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestParseURL_InvalidURL(t *testing.T) {
	tests := []struct {
		name string
		url  string
	}{
		{
			name: "wrong scheme",
			url:  "http://open?path=C%3A%2Ftest.txt",
		},
		{
			name: "missing path parameter",
			url:  "notegraph://open",
		},
		{
			name: "empty path",
			url:  "notegraph://open?path=",
		},
		{
			name: "wrong host",
			url:  "notegraph://close?path=C%3A%2Ftest.txt",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ParseURL(tt.url)
			if err == nil {
				t.Error("ParseURL() expected error, got nil")
			}
		})
	}
}
