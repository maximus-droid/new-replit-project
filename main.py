import asyncio
import os
import logging
from io import BytesIO
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, filters, CallbackContext, CallbackQueryHandler
from elevenlabs.client import ElevenLabs
from pydub import AudioSegment
import tempfile
import PyPDF2
import ebooklib
from ebooklib import epub
from docx import Document
import openpyxl
import xml.etree.ElementTree as ET

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

class AudiobookBot:
    def __init__(self, telegram_token: str, elevenlabs_api_key: str):
        self.telegram_token = telegram_token
        self.elevenlabs_client = ElevenLabs(api_key=elevenlabs_api_key)
        self.application = None
        self.selected_voice = "EXAVITQu4vr4xnSDxMaL"  # Default voice ID (Bella)
        self.available_voices = []
        
    async def start_command(self, update: Update, context: CallbackContext):
        """Handle /start command"""
        welcome_message = """
🎧 **Welcome to Audiobook Creator Bot!**

I can convert your text into high-quality audiobooks using realistic AI voices.

**Commands:**
• Send me any text and I'll convert it to speech
• Upload documents (PDF, EPUB, DOCX, TXT, etc.) for audiobook creation
• Use /voices to see available voice options with demos
• Use /setvoice to choose your preferred voice
• Use /help for more information

Just send me some text to get started! 📚✨
        """
        await update.message.reply_text(welcome_message, parse_mode='Markdown')
    
    async def help_command(self, update: Update, context: CallbackContext):
        """Handle /help command"""
        help_message = """
🎧 **Audiobook Creator Bot Help**

**How to use:**
1. Send me any text or upload a document
2. I'll convert it to high-quality speech
3. Receive your audiobook as an MP3 file

**Supported File Formats:**
📄 PDF, EPUB, DOCX, TXT, MD, XLSX, XLS, CSV

**Features:**
• Ultra-realistic AI voices with 12+ voice options
• Support for long texts (unlimited audiobook length)
• Smart text extraction from multiple file formats
• High-quality MP3 output (128kbps)

**Commands:**
• /start - Welcome message
• /voices - List available voices with audio demos
• /setvoice - Choose your preferred voice
• /help - This help message

**Tips:**
• Upload PDF books, EPUB novels, or DOCX documents for instant audiobooks
• Text is automatically extracted and cleaned from all file types
• Long documents are processed in chunks for optimal quality
• No time limits - create audiobooks of any length!
        """
        await update.message.reply_text(help_message, parse_mode='Markdown')
    
    async def load_available_voices(self):
        """Load available voices from ElevenLabs"""
        try:
            response = self.elevenlabs_client.voices.get_all()
            self.available_voices = []
            
            for voice in response.voices[:12]:  # Get top 12 voices
                self.available_voices.append({
                    'id': voice.voice_id,
                    'name': voice.name,
                    'description': voice.description or "AI-generated voice",
                    'labels': voice.labels or {}
                })
            
            logger.info(f"Loaded {len(self.available_voices)} voices")
            
        except Exception as e:
            logger.error(f"Error loading voices: {e}")
            # Fallback to default voice
            self.available_voices = [{
                'id': 'EXAVITQu4vr4xnSDxMaL',
                'name': 'Bella',
                'description': 'Young, American female voice',
                'labels': {'gender': 'female'}
            }]

    async def voices_command(self, update: Update, context: CallbackContext):
        """Handle /voices command - show available voices with demos"""
        try:
            # Always try to load voices first
            await self.load_available_voices()
            
            if not self.available_voices:
                await update.message.reply_text("❌ Sorry, couldn't load voices right now. Please try again later.")
                return
            
            keyboard = []
            for voice in self.available_voices:
                gender = voice['labels'].get('gender', 'unknown')
                button_text = f"🎤 {voice['name']} ({gender})"
                keyboard.append([InlineKeyboardButton(button_text, callback_data=f"demo_{voice['id']}")])
            
            keyboard.append([InlineKeyboardButton("❌ Cancel", callback_data="cancel")])
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            message = f"🎤 **Choose a voice to hear a demo:**\n\nFound {len(self.available_voices)} voices. Click any voice below to listen to a sample audio:"
            await update.message.reply_text(message, reply_markup=reply_markup, parse_mode='Markdown')
            
        except Exception as e:
            logger.error(f"Error in voices command: {e}")
            await update.message.reply_text("❌ Error loading voices. Please try again later.")

    async def setvoice_command(self, update: Update, context: CallbackContext):
        """Handle /setvoice command - set preferred voice"""
        try:
            # Always try to load voices first
            await self.load_available_voices()
            
            if not self.available_voices:
                await update.message.reply_text("❌ Sorry, couldn't load voices right now. Please try again later.")
                return
            
            keyboard = []
            for voice in self.available_voices:
                gender = voice['labels'].get('gender', 'unknown')
                button_text = f"🎤 {voice['name']} ({gender})"
                selected = "✅ " if voice['id'] == self.selected_voice else ""
                keyboard.append([InlineKeyboardButton(f"{selected}{button_text}", callback_data=f"select_{voice['id']}")])
            
            keyboard.append([InlineKeyboardButton("❌ Cancel", callback_data="cancel")])
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            # Find current voice name
            current_voice = next((v for v in self.available_voices if v['id'] == self.selected_voice), None)
            current_name = current_voice['name'] if current_voice else "Default"
            
            message = f"🎤 **Choose your preferred voice:**\n\nCurrent voice: **{current_name}**\nSelect a voice for all future text-to-speech conversions:"
            await update.message.reply_text(message, reply_markup=reply_markup, parse_mode='Markdown')
            
        except Exception as e:
            logger.error(f"Error in setvoice command: {e}")
            await update.message.reply_text("❌ Error loading voices. Please try again later.")

    async def handle_voice_callback(self, update: Update, context: CallbackContext):
        """Handle voice selection and demo callbacks"""
        try:
            query = update.callback_query
            await query.answer()
            
            if query.data == "cancel":
                await query.edit_message_text("❌ Operation cancelled.")
                return
            
            if query.data.startswith("demo_"):
                voice_id = query.data.replace("demo_", "")
                await self.send_voice_demo(query, voice_id)
            
            elif query.data.startswith("select_"):
                voice_id = query.data.replace("select_", "")
                await self.set_user_voice(query, voice_id)
            
        except Exception as e:
            logger.error(f"Error handling voice callback: {e}")
            try:
                await query.edit_message_text("❌ Sorry, something went wrong. Please try again.")
            except:
                pass

    async def send_voice_demo(self, query, voice_id: str):
        """Send a demo audio for the selected voice"""
        try:
            # Find voice info
            voice_info = next((v for v in self.available_voices if v['id'] == voice_id), None)
            if not voice_info:
                await query.edit_message_text("❌ Voice not found.")
                return
            
            await query.edit_message_text(f"🎧 Generating demo for **{voice_info['name']}**...", parse_mode='Markdown')
            
            # Generate demo audio
            demo_text = f"Hello! This is {voice_info['name']}. I'm here to convert your text into natural, high-quality speech. Try me out with your favorite book or article!"
            
            audio_generator = self.elevenlabs_client.text_to_speech.convert(
                text=demo_text,
                voice_id=voice_id,
                model_id="eleven_multilingual_v2",
                output_format="mp3_44100_128"
            )
            
            # Convert generator to bytes
            audio_data = b"".join(audio_generator)
            audio_buffer = BytesIO(audio_data)
            
            # Send demo audio using the bot from query context
            await query.get_bot().send_audio(
                chat_id=query.message.chat_id,
                audio=audio_buffer,
                filename=f"{voice_info['name']}_demo.mp3",
                title=f"Voice Demo: {voice_info['name']}",
                caption=f"🎤 **Voice Demo: {voice_info['name']}**\n\n{voice_info['description']}\n\nUse /setvoice to select this voice for your audiobooks!",
                parse_mode='Markdown'
            )
            
            await query.edit_message_text(f"🎧 Demo sent for **{voice_info['name']}**! Check the audio message above.", parse_mode='Markdown')
            
        except Exception as e:
            logger.error(f"Error generating voice demo: {e}")
            await query.edit_message_text(f"❌ Sorry, couldn't generate demo for this voice: {str(e)}")

    async def set_user_voice(self, query, voice_id: str):
        """Set the user's preferred voice"""
        try:
            voice_info = next((v for v in self.available_voices if v['id'] == voice_id), None)
            if not voice_info:
                await query.edit_message_text("❌ Voice not found.")
                return
            
            self.selected_voice = voice_id
            await query.edit_message_text(f"✅ **Voice updated!**\n\nYour new voice: **{voice_info['name']}**\n\nAll future text-to-speech will use this voice.", parse_mode='Markdown')
            
        except Exception as e:
            logger.error(f"Error setting voice: {e}")
            await query.edit_message_text("❌ Error setting voice. Please try again.")
    
    async def process_text_to_speech(self, text: str, voice_id: str = None) -> BytesIO:
        """Convert text to speech using ElevenLabs"""
        try:
            # Use selected voice or default
            voice_to_use = voice_id or self.selected_voice
            
            # Generate speech using the new API
            audio_generator = self.elevenlabs_client.text_to_speech.convert(
                text=text,
                voice_id=voice_to_use,
                model_id="eleven_multilingual_v2",
                output_format="mp3_44100_128"
            )
            
            # Convert generator to bytes
            audio_data = b"".join(audio_generator)
            
            return BytesIO(audio_data)
            
        except Exception as e:
            logger.error(f"Error in text-to-speech conversion: {e}")
            raise
    
    async def split_long_text(self, text: str, max_chars: int = 2500) -> list:
        """Split long text into manageable chunks for TTS"""
        if len(text) <= max_chars:
            return [text]
        
        chunks = []
        sentences = text.split('. ')
        current_chunk = ""
        
        for sentence in sentences:
            if len(current_chunk + sentence + '. ') <= max_chars:
                current_chunk += sentence + '. '
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence + '. '
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    async def create_audiobook(self, text: str, voice_id: str = None) -> BytesIO:
        """Create audiobook from long text by splitting and combining audio"""
        try:
            chunks = await self.split_long_text(text)
            logger.info(f"Processing {len(chunks)} text chunks for audiobook")
            
            if len(chunks) == 1:
                # Single chunk, process directly
                return await self.process_text_to_speech(chunks[0], voice_id)
            
            # Multiple chunks - process each and combine
            audio_segments = []
            
            for i, chunk in enumerate(chunks):
                logger.info(f"Processing chunk {i+1}/{len(chunks)}")
                audio_bytes = await self.process_text_to_speech(chunk, voice_id)
                
                # Convert to AudioSegment
                audio_segment = AudioSegment.from_mp3(audio_bytes)
                audio_segments.append(audio_segment)
                
                # Add small pause between chunks
                if i < len(chunks) - 1:
                    pause = AudioSegment.silent(duration=1000)  # 1 second pause
                    audio_segments.append(pause)
            
            # Combine all segments
            combined_audio = sum(audio_segments)
            
            # Export to BytesIO
            output_buffer = BytesIO()
            combined_audio.export(output_buffer, format="mp3", bitrate="128k")
            output_buffer.seek(0)
            
            return output_buffer
            
        except Exception as e:
            logger.error(f"Error creating audiobook: {e}")
            raise
    
    async def handle_text_message(self, update: Update, context: CallbackContext):
        """Handle text messages and convert to speech"""
        try:
            text = update.message.text
            if not text or len(text.strip()) < 10:
                await update.message.reply_text("Please send a longer text (at least 10 characters) for conversion.")
                return
            
            # Send processing message
            processing_msg = await update.message.reply_text("🎧 Converting your text to speech... This may take a moment.")
            
            # Determine if it's a long text (audiobook) or short text
            if len(text) > 1000:
                logger.info(f"Processing long text ({len(text)} chars) as audiobook")
                audio_buffer = await self.create_audiobook(text)
                filename = "audiobook.mp3"
                caption = f"🎧 **Audiobook Created!**\n\nLength: {len(text)} characters\nProcessed as: Multi-part audiobook"
            else:
                logger.info(f"Processing short text ({len(text)} chars) as single audio")
                audio_buffer = await self.process_text_to_speech(text)
                filename = "speech.mp3"
                caption = f"🎧 **Speech Generated!**\n\nLength: {len(text)} characters"
            
            # Send audio file
            await context.bot.send_audio(
                chat_id=update.effective_chat.id,
                audio=audio_buffer,
                filename=filename,
                title="Generated Speech",
                caption=caption,
                parse_mode='Markdown'
            )
            
            # Delete processing message
            await processing_msg.delete()
            
        except Exception as e:
            logger.error(f"Error handling text message: {e}")
            await update.message.reply_text(f"Sorry, I encountered an error: {str(e)}")
    
    def extract_text_from_file(self, file_content: bytes, filename: str, mime_type: str) -> str:
        """Extract text from various file formats"""
        file_extension = filename.lower().split('.')[-1] if '.' in filename else ''
        
        try:
            # PDF files
            if file_extension == 'pdf' or 'pdf' in mime_type:
                pdf_file = BytesIO(file_content)
                reader = PyPDF2.PdfReader(pdf_file)
                text = ""
                for page in reader.pages:
                    text += page.extract_text() + "\n"
                return text
            
            # EPUB files
            elif file_extension == 'epub':
                epub_file = BytesIO(file_content)
                book = epub.read_epub(epub_file)
                text = ""
                for item in book.get_items():
                    if item.get_type() == ebooklib.ITEM_DOCUMENT:
                        soup_content = item.get_content().decode('utf-8')
                        # Remove HTML tags using simple parsing
                        try:
                            root = ET.fromstring(soup_content)
                            text += ET.tostring(root, encoding='unicode', method='text') + "\n"
                        except:
                            # Fallback: remove basic HTML tags manually
                            import re
                            clean_text = re.sub('<[^<]+?>', '', soup_content)
                            text += clean_text + "\n"
                return text
            
            # DOCX files
            elif file_extension == 'docx':
                docx_file = BytesIO(file_content)
                doc = Document(docx_file)
                text = ""
                for paragraph in doc.paragraphs:
                    text += paragraph.text + "\n"
                return text
            
            # Excel files
            elif file_extension in ['xlsx', 'xls']:
                excel_file = BytesIO(file_content)
                workbook = openpyxl.load_workbook(excel_file)
                text = ""
                for sheet_name in workbook.sheetnames:
                    sheet = workbook[sheet_name]
                    text += f"Sheet: {sheet_name}\n"
                    for row in sheet.iter_rows(values_only=True):
                        row_text = " | ".join([str(cell) if cell is not None else "" for cell in row])
                        if row_text.strip():
                            text += row_text + "\n"
                    text += "\n"
                return text
            
            # Text files (TXT, MD, etc.)
            else:
                try:
                    return file_content.decode('utf-8')
                except UnicodeDecodeError:
                    try:
                        return file_content.decode('latin-1')
                    except UnicodeDecodeError:
                        return file_content.decode('utf-8', errors='ignore')
                        
        except Exception as e:
            logger.error(f"Error extracting text from {filename}: {e}")
            raise Exception(f"Could not extract text from {file_extension.upper()} file: {str(e)}")

    async def handle_document(self, update: Update, context: CallbackContext):
        """Handle document uploads (PDF, EPUB, TXT, DOCX, etc.)"""
        try:
            document = update.message.document
            
            # Check file size (limit to 20MB as per Telegram)
            if document.file_size > 20 * 1024 * 1024:
                await update.message.reply_text("File too large. Please send files smaller than 20MB.")
                return
            
            # Get file extension and check if supported
            filename = document.file_name or "document"
            file_extension = filename.lower().split('.')[-1] if '.' in filename else ''
            supported_formats = ['pdf', 'epub', 'txt', 'md', 'docx', 'xlsx', 'xls', 'csv']
            
            if file_extension not in supported_formats:
                supported_list = ", ".join([f".{fmt}" for fmt in supported_formats])
                await update.message.reply_text(f"📄 **Supported file formats:**\n{supported_list}\n\nPlease send a supported file type.")
                return
            
            # Send processing message
            processing_msg = await update.message.reply_text(f"📄 Downloading and extracting text from {file_extension.upper()} file...")
            
            # Download file
            file = await context.bot.get_file(document.file_id)
            file_content = await file.download_as_bytearray()
            
            # Extract text based on file type
            await processing_msg.edit_text(f"📖 Extracting text from {file_extension.upper()} file...")
            text = self.extract_text_from_file(file_content, filename, document.mime_type or "")
            
            if len(text.strip()) < 10:
                await update.message.reply_text("The document appears to be empty or contains no readable text.")
                return
            
            # Update processing message
            await processing_msg.edit_text("🎧 Converting document to audiobook... This may take several minutes for long texts.")
            
            # Process as audiobook
            audio_buffer = await self.create_audiobook(text)
            
            # Send audiobook
            await context.bot.send_audio(
                chat_id=update.effective_chat.id,
                audio=audio_buffer,
                filename=f"audiobook_{filename}.mp3",
                title=f"Audiobook: {filename}",
                caption=f"🎧 **Audiobook from {file_extension.upper()} Document**\n\nOriginal file: {filename}\nExtracted text: {len(text)} characters\nFormat: {file_extension.upper()}",
                parse_mode='Markdown'
            )
            
            # Delete processing message
            await processing_msg.delete()
            
        except Exception as e:
            logger.error(f"Error handling document: {e}")
            await update.message.reply_text(f"Sorry, I encountered an error processing your document: {str(e)}")
    
    def setup_handlers(self):
        """Setup all message handlers"""
        # Command handlers
        self.application.add_handler(CommandHandler("start", self.start_command))
        self.application.add_handler(CommandHandler("help", self.help_command))
        self.application.add_handler(CommandHandler("voices", self.voices_command))
        self.application.add_handler(CommandHandler("setvoice", self.setvoice_command))
        
        # Callback handler for inline keyboards
        self.application.add_handler(CallbackQueryHandler(self.handle_voice_callback))
        
        # Message handlers
        self.application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_text_message))
        self.application.add_handler(MessageHandler(filters.Document.ALL, self.handle_document))
    
    def run(self):
        """Run the bot"""
        # Create application
        self.application = Application.builder().token(self.telegram_token).build()
        
        # Setup handlers
        self.setup_handlers()
        
        logger.info("Starting Audiobook Bot...")
        
        # Run the bot
        self.application.run_polling(allowed_updates=Update.ALL_TYPES)

def main():
    # Get API keys from environment variables
    telegram_token = os.getenv('TELEGRAM_BOT_TOKEN')
    elevenlabs_api_key = os.getenv('ELEVENLABS_API_KEY')
    
    if not telegram_token:
        print("❌ Error: TELEGRAM_BOT_TOKEN environment variable is required")
        print("Please set your Telegram bot token in the environment variables.")
        return
    
    if not elevenlabs_api_key:
        print("❌ Error: ELEVENLABS_API_KEY environment variable is required")
        print("Please set your ElevenLabs API key in the environment variables.")
        return
    
    # Create and run bot
    bot = AudiobookBot(telegram_token, elevenlabs_api_key)
    bot.run()

if __name__ == "__main__":
    main()