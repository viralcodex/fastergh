import { readFileSync } from "node:fs";
import { $ } from "bun";


const STOP_TOKEN = "<I HAVE COMPLETED THE TASK>";

const makePrompt = (goal: string) =>
    `Continue working until you believe the task is complete. As a reminder, the goal is: ${goal}. The above goal was copy pasted in, resume from where you left off. Output ${STOP_TOKEN} when you have completed the task.`;

async function run(
    goal: string,
    model: "openai/gpt-5.3-codex" | "anthropic/claude-opus-4-6",
) {
    const prompt = makePrompt(goal);
    let ralph = "";
    let firstRun = true;
    while (!ralph.includes(STOP_TOKEN)) {
        const command = firstRun
            ? $`opencode run --attach http://100.81.219.45:39821 --model ${model} ${prompt}`
            : $`opencode run --attach http://100.81.219.45:39821 --model ${model} --continue ${prompt}`;

        ralph = await command.text();
        firstRun = false;
    }
    await $`opencode --run Make a git commit of your changes, do not push`;
}

await run(readFileSync("./PLAN.md", "utf-8"), "anthropic/claude-opus-4-6");
