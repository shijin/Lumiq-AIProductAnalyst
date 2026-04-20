import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from langchain_anthropic import ChatAnthropic
from langchain.agents import AgentExecutor
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.tools import tool
from langchain.agents import create_tool_calling_agent
from agent.tools import (
    ingest_and_analyze,
    get_top_insights,
    explain_insight,
    get_feedback_summary,
    filter_by_intent
)
from config.settings import ANTHROPIC_API_KEY

# Tools available to the agent
TOOLS = [
    ingest_and_analyze,
    get_top_insights,
    explain_insight,
    get_feedback_summary,
    filter_by_intent
]

# System prompt — defines agent personality and behavior
SYSTEM_PROMPT = """You are Lumiq, an expert AI Product Analyst agent.

Your job is to help product managers understand their user feedback deeply.

You have access to these tools:
- ingest_and_analyze: Run full analysis on new feedback data
- get_top_insights: Get the top prioritized problems
- explain_insight: Deep dive into a specific problem
- get_feedback_summary: Overview statistics of analyzed feedback
- filter_by_intent: Filter by bug, complaint, churn_signal etc.

Your personality:
- You think like a senior PM with 10 years experience
- You are direct and actionable — no fluff
- You always explain WHY, not just WHAT
- You cite evidence when making claims
- You admit uncertainty when confidence is low

When a user asks a question:
1. Decide which tool to call
2. Call it with the right parameters
3. Interpret the results in plain English
4. Always end with a recommended next action

Never make up data. Only use what the tools return.
If no analysis has been run yet, ask the user to provide feedback data first.
"""

def create_lumiq_agent():
    """Create and return the Lumiq agent."""

    llm = ChatAnthropic(
        model="claude-sonnet-4-6",
        api_key=ANTHROPIC_API_KEY,
        temperature=0
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])

    agent = create_tool_calling_agent(llm, TOOLS, prompt)

    executor = AgentExecutor(
        agent=agent,
        tools=TOOLS,
        verbose=True,
        max_iterations=5,
        handle_parsing_errors=True
    )

    return executor


# Store chat history in memory manually
chat_history = []

def chat(agent, user_message: str) -> str:
    """Send a message to the agent and get a response."""
    global chat_history

    response = agent.invoke({
        "input": user_message,
        "chat_history": chat_history
    })

    # Update history
    chat_history.append(HumanMessage(content=user_message))
    chat_history.append(AIMessage(content=response["output"]))

    # Keep last 10 messages to avoid context overflow
    if len(chat_history) > 10:
        chat_history = chat_history[-10:]

    return response["output"]


if __name__ == "__main__":
    print("Lumiq Agent started. Type 'exit' to quit.\n")
    agent = create_lumiq_agent()

    while True:
        user_input = input("You: ").strip()
        if user_input.lower() in ["exit", "quit"]:
            break
        if not user_input:
            continue
        response = chat(agent, user_input)
        print(f"\nLumiq: {response}\n")