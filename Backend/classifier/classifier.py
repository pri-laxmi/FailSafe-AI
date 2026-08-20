import os
import json
from pathlib import Path

from groq import Groq
from dotenv import load_dotenv

try:
    from Backend.llm.groq_client import groq_chat_completion
except ModuleNotFoundError:
    from llm.groq_client import groq_chat_completion

load_dotenv()

BACKEND_DIR = Path(__file__).resolve().parents[1]

TRACES_DIR = BACKEND_DIR / "data" / "traces"
OUTPUT_DIR = BACKEND_DIR / "data" / "classifications"
PROMPT_FILE = BACKEND_DIR / "classifier" / "classifier_prompt.txt"

MODEL_NAME = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")

client = Groq(
    api_key=os.environ.get("GROQ_API_KEY")
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
    # GROQ API CALL
    # -----------------------------------------
    response = groq_chat_completion(
        client,
        model=MODEL_NAME,
        messages=[{"role": "user", "content": classifier_input}],
        temperature=0
    )

    result_text = (response.choices[0].message.content or "").strip()

    # Remove markdown code fences if the model adds them
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
            if "429" in str(error) or "rate_limit" in str(error).lower():
                print("\n⚠️ Groq quota exhausted.")
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