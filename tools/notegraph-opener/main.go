package main

import (
	"fmt"
	"os"

	"notegraph-opener/handler"
)

func main() {
	defer handler.CloseLog()

	if len(os.Args) < 2 {
		fmt.Println("Usage: notegraph-opener <url>")
		fmt.Println("Example: notegraph-opener notegraph://open?path=C:/test.txt")
		os.Exit(1)
	}

	url := os.Args[1]

	if err := handler.HandleURL(url); err != nil {
		handler.LogError(err.Error())
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
