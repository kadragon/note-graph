package handler

import (
	"reflect"
	"testing"
)

func TestBuildOpenCommand_QuotesPath(t *testing.T) {
	path := `C:\Google Drive\R&D\file.pdf`
	cmd := buildOpenCommand(path)

	expectedArgs := []string{
		"cmd",
		"/c",
		"start",
		"",
		"\"" + path + "\"",
	}

	if !reflect.DeepEqual(cmd.Args, expectedArgs) {
		t.Errorf("buildOpenCommand args = %v, want %v", cmd.Args, expectedArgs)
	}
}
