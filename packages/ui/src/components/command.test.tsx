import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Command, CommandInput } from "./command";

afterEach(() => {
	cleanup();
});

describe("CommandInput", () => {
	it("renders leading and trailing content", () => {
		render(
			<Command>
				<CommandInput
					placeholder="Search"
					leading={<span data-testid="leading">lead</span>}
					trailing={<span data-testid="trailing">trail</span>}
				/>
			</Command>,
		);

		expect(screen.getByTestId("leading")).toBeTruthy();
		expect(screen.getByTestId("trailing")).toBeTruthy();
		expect(screen.getByPlaceholderText("Search")).toBeTruthy();
	});

	it("still supports onValueChange with decorations", () => {
		const onValueChange = vi.fn();

		render(
			<Command>
				<CommandInput
					placeholder="Search"
					onValueChange={onValueChange}
					leading={<span>lead</span>}
					trailing={<span>trail</span>}
				/>
			</Command>,
		);

		fireEvent.change(screen.getByPlaceholderText("Search"), {
			target: { value: "issues by rhys" },
		});

		expect(onValueChange).toHaveBeenCalledWith("issues by rhys");
	});
});
