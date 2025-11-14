from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

if not OPENROUTER_API_KEY:
    raise ValueError("OPENROUTER_API_KEY is not set in environment variables.")

client = OpenAI(
  base_url="https://openrouter.ai/api/v1",
  api_key=OPENROUTER_API_KEY,
)

response = client.responses.create(
    model="google/gemini-2.5-flash-lite-preview-09-2025",
    input=[
        {
            "role": "user",
            "content": [
                {
                    "type": "input_text",
                    "text": """I've attached a PDF file of a church bulletin. There may be multiple churches listed in the bulletin, or there may be only one. Can you extract out the mass times and reconciliation/confession times, and output in a suitable JSON format. Only respond with JSON, do not include any other text or wrap the text in code blocks.
Here is an example of the JSON format I would like you to use:

{
    "name": "St. John the Baptist",
    "address": "225 Brock St, Amherstburg, ON N9V 2H3",
    "map": "https://maps.app.goo.gl/ALcbZhAyh731bFBk9",
    "coordinates": [42.1031731983902, -83.10377441840853],
    "website": "http://www.ahcfop.ca/",
    "phone": "+15197365418",
    "masses": [
        {
            "day": "Saturday",
            "time": "1700"
        },
        {
            "day": "Sunday",
            "time": "1100"
        }
    ],
    "daily_masses": [
        {
            "day": "Wednesday",
            "time": "0900"
        },
        {
            "day": "Friday",
            "time": "0900"
        }
    ],
    "confession": [
        {
            "day": "Saturday",
            "start": "0945",
            "end": "1030"
        }
    ],
    "adoration": [
        {
            "day": "Wednesday",
            "start": "0930",
            "end": "2130"
        }
    ]
}
 
If there are multiple churches listed, please output an array of these objects. If any information is missing (for example, if there are no daily masses), please omit that field from the output.
""",
                },
                {
                    "type": "input_file",
                    "file_url": "https://files.ecatholic.com/26217/bulletins/20251109.pdf",
                },
            ],
        },
    ]
)

print(response.output_text)