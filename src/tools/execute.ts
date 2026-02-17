import { getTool } from "./registry";

export interface ToolExecutionResult {
  tool: string;
  input: any;
  output: any;
  success: boolean;
  error?: string;
}

export async function executeTool(name: string, input: any): Promise<ToolExecutionResult> {
  const tool = getTool(name);

  if (!tool) {
    return {
      tool: name,
      input,
      output: null,
      success: false,
      error: `Tool '${name}' not found`
    };
  }

  try {
    const output = await tool.run(input);

    return {
      tool: name,
      input,
      output,
      success: true
    };
  } catch (err: any) {
    return {
      tool: name,
      input,
      output: null,
      success: false,
      error: err?.message || "Unknown tool execution error"
    };
  }
}