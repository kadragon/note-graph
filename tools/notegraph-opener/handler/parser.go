package handler

import (
	"errors"
	"net/url"
	"strings"
)

var (
	ErrInvalidScheme    = errors.New("invalid URL scheme: expected 'notegraph'")
	ErrInvalidHost      = errors.New("invalid URL host: expected 'open'")
	ErrMissingPath      = errors.New("missing 'path' parameter")
	ErrEmptyPath        = errors.New("path parameter is empty")
)

// ParseURL parses a notegraph:// URL and returns the file path.
// Expected format: notegraph://open?path=<url-encoded-path>
func ParseURL(rawURL string) (string, error) {
	// Handle URL without proper scheme prefix
	if !strings.HasPrefix(rawURL, "notegraph://") {
		return "", ErrInvalidScheme
	}

	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "", err
	}

	// Validate scheme
	if parsed.Scheme != "notegraph" {
		return "", ErrInvalidScheme
	}

	// Validate host (action)
	if parsed.Host != "open" {
		return "", ErrInvalidHost
	}

	// Extract path parameter
	query := parsed.Query()
	pathParam := query.Get("path")

	if pathParam == "" {
		// Check if path exists but is empty
		if _, exists := query["path"]; exists {
			return "", ErrEmptyPath
		}
		return "", ErrMissingPath
	}

	return pathParam, nil
}
