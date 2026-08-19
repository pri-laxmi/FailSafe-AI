import os
import json
from pathlib import Path

from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

BACKEND_DIR = Path(__file__).resolve().parents[1]

TRACES_DIR = BACKEND_DIR / "data" / "traces"
OUTPUT_DIR = BACKEND_DIR / "data" / "classifications"
PROMPT_FILE = BACKEND_DIR / "classifier" / "classifier_prompt.txt"

MODEL_NAME = "gemini-3.6-flash"

client = genai.Client(
    api_key=os.environ.get("GEMINI_API_KEY")
)


def load_prompt():
    with PROMPT_FILE.open("r", encoding="utf-8") as file:
        return file.read()


def classify_trace(trace_file: Path):

    scenario_id = trace_file.stem
    output_file = OUTPUT_DIR / trace_file.name

    # -----------------------------------------
    # SKIP ALREADY CLASSIFIED SCENARIOS
    # -----------------------------------------
    if output_file.exists():
        print(f"⏩ {scenario_id} already classified - skipping API call")
        return "SKIPPED"

    # -----------------------------------------
    # LOAD TRACE
    # -----------------------------------------
    with trace_file.open("r", encoding="utf-8") as file:
        trace_data = json.load(file)

    prompt = load_prompt()

    classifier_input = f"""
{prompt}

TRACE TO CLASSIFY:

{json.dumps(trace_data, indent=2)}

Return ONLY valid JSON.
"""

    # -----------------------------------------
    # GEMINI API CALL
    # -----------------------------------------
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=classifier_input,
        config=types.GenerateContentConfig(
            temperature=0
        )
    )

    result_text = response.text.strip()

    # Remove markdown code fences if Gemini adds them
    if result_text.startswith("```"):
        result_text = (
            result_text
            .replace("```json", "")
            .replace("```", "")
            .strip()
        )

    result = json.loads(result_text)

    # -----------------------------------------
    # SAVE CLASSIFICATION
    # -----------------------------------------
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with output_file.open("w", encoding="utf-8") as file:
        json.dump(result, file, indent=2, ensure_ascii=False)

    print(f"✅ Classified {scenario_id}")

    return "CLASSIFIED"


def main():

    print("🚀 Classifier Starting...\n")

    trace_files = sorted(TRACES_DIR.glob("S*.json"))

    print(f"Found {len(trace_files)} traces")
    print(f"Output directory: {OUTPUT_DIR}\n")

    classified = 0
    skipped = 0
    failed = 0

    for trace in trace_files:

        try:
            result = classify_trace(trace)

            if result == "CLASSIFIED":
                classified += 1

            elif result == "SKIPPED":
                skipped += 1

        except Exception as error:

            failed += 1

            print(f"❌ {trace.stem} failed: {error}")

            # Stop immediately if quota is exhausted
            if "429" in str(error) or "RESOURCE_EXHAUSTED" in str(error):
                print("\n⚠️ Gemini quota exhausted.")
                print("Stopping classifier to avoid unnecessary API calls.\n")
                break

    print("\n" + "=" * 50)
    print("🏁 CLASSIFICATION COMPLETE")
    print("=" * 50)

    print(f"Newly classified : {classified}")
    print(f"Skipped          : {skipped}")
    print(f"Failed           : {failed}")
    print(f"Total traces     : {len(trace_files)}")
    print(f"Results saved in : {OUTPUT_DIR}")


if __name__ == "__main__":
    main()