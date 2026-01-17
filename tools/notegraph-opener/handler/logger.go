package handler

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
)

var logFile *os.File

// getLogPath returns the path to the log file.
func getLogPath() string {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		appData = "."
	}
	return filepath.Join(appData, "notegraph-opener", "log.txt")
}

// initLog initializes the log file.
func initLog() error {
	if logFile != nil {
		return nil
	}

	logPath := getLogPath()
	logDir := filepath.Dir(logPath)

	// Create directory if it doesn't exist
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return err
	}

	// Open log file in append mode
	var err error
	logFile, err = os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}

	return nil
}

// writeLog writes a log entry.
func writeLog(level, message string) {
	if err := initLog(); err != nil {
		// If we can't log, just print to stderr
		fmt.Fprintf(os.Stderr, "[%s] %s: %s\n", time.Now().Format("2006-01-02 15:04:05"), level, message)
		return
	}

	timestamp := time.Now().Format("2006-01-02 15:04:05")
	logEntry := fmt.Sprintf("[%s] %s: %s\n", timestamp, level, message)

	logFile.WriteString(logEntry)
}

// LogInfo logs an info message.
func LogInfo(message string) {
	writeLog("INFO", message)
}

// LogError logs an error message.
func LogError(message string) {
	writeLog("ERROR", message)
}

// CloseLog closes the log file.
func CloseLog() {
	if logFile != nil {
		logFile.Close()
		logFile = nil
	}
}
