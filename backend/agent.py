import json
import re
from typing import List, Dict, Any
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END
from backend.slm_client import SLMClient
from backend.rag import LightweightVectorStore
from backend import tools

# 1. State Definition
class AgentState(TypedDict):
    query: str
    history: List[Dict[str, str]]
    thoughts: List[str]
    current_thought: str
    tool_name: str
    tool_arg: str
    tool_output: str
    retrieved_contexts: List[str]
    citations: List[str]
    final_response: str
    reasoning_logs: List[Dict[str, str]]  # Records: {"step": "THINK"|"ACTION"|"OBSERVE"|"OUTPUT", "text": "..."}
    step_count: int

class LangGraphAgent:
    """
    LangGraph-based AI Agent that implements the THINK -> ACTION -> OBSERVE -> OUTPUT workflow.
    Uses RAG retrieval and web search/scrape tools to address queries about financial filings.
    """

    def __init__(self, slm_client: SLMClient, vector_store: LightweightVectorStore):
        self.slm_client = slm_client
        self.vector_store = vector_store
        self.graph = self._compile_graph()

    def _compile_graph(self) -> Any:
        # Create StateGraph
        builder = StateGraph(AgentState)

        # Add nodes
        builder.add_node("think", self.think_node)
        builder.add_node("action", self.action_node)
        builder.add_node("observe", self.observe_node)
        builder.add_node("output", self.output_node)

        # Set entry point
        builder.add_edge(START, "think")

        # Define router logic from THINK
        builder.add_conditional_edges(
            "think",
            self.think_router,
            {
                "call_tool": "action",
                "respond": "output"
            }
        )

        # Define edge from ACTION to OBSERVE
        builder.add_edge("action", "observe")

        # Define router logic from OBSERVE
        builder.add_conditional_edges(
            "observe",
            self.observe_router,
            {
                "loop_think": "think",
                "respond": "output"
            }
        )

        # Define edge from OUTPUT to END
        builder.add_edge("output", END)

        return builder.compile()

    # --- Node Implementations ---

    def think_node(self, state: AgentState) -> Dict[str, Any]:
        """
        THINK: Analyze query and history to determine plan.
        Decides whether to invoke tools (RAG, Web, Web Scrape) or finalize the output.
        """
        query = state["query"]
        history = state["history"]
        step_count = state.get("step_count", 0) + 1
        
        # Compile contextual instructions
        system_prompt = (
            "You are FinSight AI, a financial agent. Analyze the user query. "
            "Decide if you need to fetch information using RAG retrieval, web search, web scrape, or if you can answer directly.\n"
            "Respond ONLY in valid JSON. No conversational fillers or markdown wrappers. Example output:\n"
            "{\n"
            "  \"thought\": \"I need to retrieve risk factor disclosures from the document to see supply chain exposures.\",\n"
            "  \"call_tool\": \"rag_retrieve\",\n"
            "  \"tool_argument\": \"supply chain risks shortages vulnerability\"\n"
            "}\n"
            "Available tools: 'rag_retrieve', 'web_search', 'web_scrape', 'none'.\n"
            "Use 'none' if you have gathered enough information to answer."
        )

        # Formulate prompt including preceding tool outputs
        prev_contexts = "\n".join(state.get("retrieved_contexts", []))
        prompt = f"User Query: {query}\n"
        if history:
            prompt += f"Conversation History: {json.dumps(history)}\n"
        if prev_contexts:
            prompt += f"Context retrieved so far:\n{prev_contexts}\n"
        
        prompt += f"\nThis is reasoning cycle #{step_count}. Decide your next action. Respond in JSON."

        # Query LLM
        response_text = self.slm_client.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.1,
            response_format_json=True
        )

        # Parse output
        thought = "Thinking..."
        tool_name = "none"
        tool_arg = ""

        try:
            # Strip potential markdown fences
            cleaned = re.sub(r'```(?:json)?|```', '', response_text).strip()
            decision = json.loads(cleaned)
            thought = decision.get("thought", "Analyzing query requirements.")
            tool_name = decision.get("call_tool", "none")
            tool_arg = decision.get("tool_argument", "")
        except Exception as e:
            print(f"[Agent] Failed to parse thought JSON: {e}. Raw: {response_text}")
            # Heuristic regex parsing if JSON format is broken
            m_thought = re.search(r'"thought"\s*:\s*"([^"]+)"', response_text)
            m_tool = re.search(r'"call_tool"\s*:\s*"([^"]+)"', response_text)
            m_arg = re.search(r'"tool_argument"\s*:\s*"([^"]+)"', response_text)
            
            if m_thought: thought = m_thought.group(1)
            if m_tool: tool_name = m_tool.group(1)
            if m_arg: tool_arg = m_arg.group(1)

        # Max steps safeguard: Force termination if looping too long
        if step_count >= 5:
            print("[Agent] Safeguard: Reached maximum reasoning iterations. Forcing completion.")
            tool_name = "none"

        # Record thought log
        log_entry = {"step": "THINK", "text": f"Thought: {thought}\nAction decision: Call '{tool_name}' with parameter: '{tool_arg}'"}
        
        logs = state.get("reasoning_logs", []) + [log_entry]
        thoughts = state.get("thoughts", []) + [thought]

        return {
            "current_thought": thought,
            "thoughts": thoughts,
            "tool_name": tool_name,
            "tool_arg": tool_arg,
            "reasoning_logs": logs,
            "step_count": step_count
        }

    def think_router(self, state: AgentState) -> str:
        """Determines whether to call a tool or compile final response."""
        tool = state.get("tool_name", "none")
        if tool in ["rag_retrieve", "web_search", "web_scrape"]:
            return "call_tool"
        return "respond"

    def action_node(self, state: AgentState) -> Dict[str, Any]:
        """
        ACTION: Executes the selected tool.
        """
        tool_name = state["tool_name"]
        tool_arg = state["tool_arg"]
        
        print(f"[Agent] Executing tool: '{tool_name}' with argument: '{tool_arg}'")
        output = ""
        
        if tool_name == "rag_retrieve":
            output = tools.rag_retrieve_tool(self.vector_store, tool_arg)
        elif tool_name == "web_search":
            output = tools.web_search_tool(tool_arg)
        elif tool_name == "web_scrape":
            output = tools.web_scrape_tool(tool_arg)
        else:
            output = "Action Error: Invalid tool selected."

        log_entry = {"step": "ACTION", "text": f"Executed tool: '{tool_name}' ({tool_arg}). Result obtained."}
        logs = state.get("reasoning_logs", []) + [log_entry]
        
        return {
            "tool_output": output,
            "reasoning_logs": logs
        }

    def observe_node(self, state: AgentState) -> Dict[str, Any]:
        """
        OBSERVE: Analyze the results of the tool run.
        Determine if there is enough information or if more questions must be asked.
        """
        tool_name = state["tool_name"]
        tool_output = state["tool_output"]
        query = state["query"]
        
        system_prompt = (
            "You are FinSight AI. Review the tool output in response to the user query.\n"
            "Assess whether the output contains the necessary facts to resolve the user request.\n"
            "Respond ONLY in valid JSON. No conversational fillers or markdown wrappers. Example output:\n"
            "{\n"
            "  \"observation\": \"We retrieved details on competitor Apex's revenue margins. However, we still need target company's margin to complete the benchmarking comparison.\",\n"
            "  \"has_sufficient_information\": false\n"
            "}"
        )
        
        prompt = (
            f"User Query: {query}\n"
            f"Last Tool Called: {tool_name}\n"
            f"Tool Output:\n{tool_output}\n\n"
            f"Determine if you have enough information to answer the query. Respond in JSON."
        )

        response_text = self.slm_client.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.1,
            response_format_json=True
        )

        observation = "Observation: Retrieved data."
        sufficient = True

        try:
            cleaned = re.sub(r'```(?:json)?|```', '', response_text).strip()
            obs_json = json.loads(cleaned)
            observation = obs_json.get("observation", "Analyzed tool output.")
            sufficient = obs_json.get("has_sufficient_information", True)
        except Exception as e:
            print(f"[Agent] Failed to parse observation JSON: {e}")
            m_obs = re.search(r'"observation"\s*:\s*"([^"]+)"', response_text)
            m_suff = re.search(r'"has_sufficient_information"\s*:\s*(true|false)', response_text)
            if m_obs: observation = m_obs.group(1)
            if m_suff: sufficient = m_suff.group(1) == "true"

        # Append tool context to retrieved context pool
        prev_contexts = state.get("retrieved_contexts", [])
        new_context_entry = f"[{tool_name} output]: {tool_output}"
        updated_contexts = prev_contexts + [new_context_entry]

        # Extract potential citations from output (e.g. matching "Page X, Section Y" or URLs)
        citations = state.get("citations", [])
        if tool_name == "rag_retrieve":
            matches = re.findall(r'\(Section:\s*(.*?),\s*Page:\s*(\d+)', tool_output)
            for sec, pg in matches:
                citations.append(f"Filing Section '{sec}' (Page {pg})")
        elif tool_name == "web_search" or tool_name == "web_scrape":
            urls = re.findall(r'https?://[^\s\)]+', tool_output)
            for url in urls:
                citations.append(f"Web Source: {url}")

        log_entry = {"step": "OBSERVE", "text": f"Observation: {observation}\nSufficient Info: {sufficient}"}
        logs = state.get("reasoning_logs", []) + [log_entry]

        # Determine next step
        next_step = "loop_think" if not sufficient else "respond"

        return {
            "retrieved_contexts": updated_contexts,
            "citations": list(set(citations)),  # Deduplicate
            "reasoning_logs": logs,
            "tool_name": "none" if sufficient else tool_name,  # reset if complete
            "tool_output": ""
        }

    def observe_router(self, state: AgentState) -> str:
        """Decides if we loop back to think, or proceed to final output compilation."""
        if state.get("tool_name", "none") != "none":
            return "loop_think"
        return "respond"

    def output_node(self, state: AgentState) -> Dict[str, Any]:
        """
        OUTPUT: Compiles the final response string incorporating all gathered facts,
        along with references and sources.
        """
        query = state["query"]
        contexts = "\n".join(state.get("retrieved_contexts", []))
        citations = state.get("citations", [])
        
        system_prompt = (
            "You are FinSight AI. Write a comprehensive, detailed financial report addressing the user's query.\n"
            "Draw strictly from the retrieved contexts. Highlight risks, comparison metrics, and outlooks as requested.\n"
            "You must cite your sources at the end of the text. Do not make up any numbers."
        )

        prompt = f"User Query: {query}\n\nRetrieved context and tools output:\n{contexts}\n\nCompile your final response."
        
        final_answer = self.slm_client.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.2
        )

        # Append citations to response if not explicitly structured by LLM
        if citations and not any(cit in final_answer for cit in citations[:2]):
            final_answer += "\n\n**Sources & Citations:**\n" + "\n".join([f"- {c}" for c in citations])

        log_entry = {"step": "OUTPUT", "text": "Compiled final analysis report successfully."}
        logs = state.get("reasoning_logs", []) + [log_entry]

        return {
            "final_response": final_answer,
            "reasoning_logs": logs
        }

    # --- External Execution Interface ---

    def run(self, query: str, history: List[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Runs the agent workflow starting with the query.
        Returns response, citations, and complete THINK-ACTION-OBSERVE logs.
        """
        initial_state: AgentState = {
            "query": query,
            "history": history or [],
            "thoughts": [],
            "current_thought": "",
            "tool_name": "none",
            "tool_arg": "",
            "tool_output": "",
            "retrieved_contexts": [],
            "citations": [],
            "final_response": "",
            "reasoning_logs": [],
            "step_count": 0
        }

        print(f"[Agent] Launching LangGraph pipeline for query: '{query}'")
        final_state = self.graph.invoke(initial_state)
        
        return {
            "response": final_state["final_response"],
            "citations": final_state["citations"],
            "logs": final_state["reasoning_logs"]
        }
