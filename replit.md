# Overview

Audiobook Creator Bot is a Telegram bot that converts text to speech using ElevenLabs AI voice technology. The bot allows users to send text messages or documents and receive high-quality MP3 audiobook files in return. It provides a simple interface for creating audiobooks from any text content through Telegram's messaging platform. The bot features advanced voice selection capabilities with demo previews, allowing users to choose from multiple AI voices for their audiobooks.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Bot Framework
- **Telegram Bot API Integration**: Uses python-telegram-bot library for handling Telegram interactions
- **Asynchronous Architecture**: Built with asyncio for handling multiple concurrent requests efficiently
- **Command-based Interface**: Implements command handlers for `/start`, `/help`, `/voices`, and `/setvoice` commands
- **Interactive Voice Selection**: Inline keyboard interface for choosing voices with real-time demos
- **Voice Demo System**: Generates sample audio clips for voice preview before selection
- **Message Processing**: Handles both text messages and document uploads for text-to-speech conversion

## Text-to-Speech Pipeline
- **ElevenLabs Integration**: Primary TTS service using their AI voice synthesis API
- **Voice Configuration**: Supports multiple voice options with customizable voice settings
- **Audio Processing**: Uses pydub for audio format conversion and optimization
- **File Management**: Temporary file handling for audio processing and delivery

## Audio Delivery System
- **Format Standardization**: Converts audio to MP3 format for universal compatibility
- **File Streaming**: Delivers audio files directly through Telegram's file upload system
- **Memory Management**: Uses BytesIO and temporary files to handle audio processing efficiently

## Error Handling and Logging
- **Comprehensive Logging**: Structured logging system for debugging and monitoring
- **Graceful Error Recovery**: Error handling for API failures and invalid inputs
- **User Feedback**: Informative error messages sent back to users when processing fails

# External Dependencies

## Core Services
- **Telegram Bot API**: Primary interface for user interactions and file delivery
- **ElevenLabs API**: AI-powered text-to-speech conversion service with realistic voice synthesis

## Python Libraries
- **python-telegram-bot**: Telegram bot framework for handling updates and commands
- **elevenlabs**: Official SDK for ElevenLabs text-to-speech API
- **pydub**: Audio manipulation library for format conversion and processing
- **asyncio**: Built-in Python library for asynchronous programming

## System Requirements
- **Environment Variables**: Requires TELEGRAM_BOT_TOKEN and ELEVENLABS_API_KEY
- **File System**: Temporary file storage for audio processing
- **Network Dependencies**: Stable internet connection for API communications