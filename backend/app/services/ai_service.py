"""
AI Service for Backlot Co-pilot
Supports both Anthropic (Claude) and OpenAI (GPT) models
"""
import json
from typing import Optional, List, Dict, Any
from app.core.config import settings

# System prompt for the production co-pilot
SYSTEM_PROMPT = """You are an AI production assistant for independent filmmakers using the Backlot production hub. You help with:

- Production scheduling and planning
- Task management and prioritization
- Crew organization and role recommendations
- Location scouting checklists
- Call sheet creation guidance
- Budget management tips
- Equipment/gear recommendations
- Industry best practices

Key guidelines:
- Be concise and practical - filmmakers are busy
- Provide actionable advice, not just theory
- Use industry-standard terminology
- Offer specific examples when helpful
- Format responses with markdown for readability (headers, lists, bold)
- When suggesting tasks or checklists, use checkbox format: - [ ] Task
- Tailor advice to indie/low-budget productions when appropriate
- Be encouraging but realistic about challenges

You have context about the current project. Use it to personalize your responses."""


async def get_ai_response(
    messages: List[Dict[str, str]],
    project_context: Optional[Dict[str, Any]] = None,
    max_tokens: int = 1024
) -> str:
    """
    Get AI response using configured AI provider (Anthropic or OpenAI)

    Args:
        messages: List of message dicts with 'role' and 'content'
        project_context: Optional project data to include in context
        max_tokens: Maximum tokens in response

    Returns:
        AI response string
    """
    # Build context message
    context_parts = []
    if project_context:
        context_parts.append(f"Current Project: {project_context.get('title', 'Untitled')}")
        if project_context.get('project_type'):
            context_parts.append(f"Type: {project_context['project_type']}")
        if project_context.get('genre'):
            context_parts.append(f"Genre: {project_context['genre']}")
        if project_context.get('status'):
            status_labels = {
                'pre_production': 'Pre-Production',
                'production': 'Production',
                'post_production': 'Post-Production',
                'completed': 'Completed',
                'on_hold': 'On Hold',
            }
            context_parts.append(f"Status: {status_labels.get(project_context['status'], project_context['status'])}")
        if project_context.get('logline'):
            context_parts.append(f"Logline: {project_context['logline']}")

    context_message = "\n".join(context_parts) if context_parts else ""
    full_system = SYSTEM_PROMPT
    if context_message:
        full_system += f"\n\nProject Context:\n{context_message}"

    # Try Anthropic first (Claude)
    if settings.ANTHROPIC_API_KEY:
        try:
            return await _call_anthropic(messages, full_system, max_tokens)
        except Exception as e:
            print(f"Anthropic API error: {e}")
            # Fall through to OpenAI if available

    # Try OpenAI as fallback
    if settings.OPENAI_API_KEY:
        try:
            return await _call_openai(messages, full_system, max_tokens)
        except Exception as e:
            print(f"OpenAI API error: {e}")

    # No AI provider configured - return helpful fallback
    return _get_fallback_response(messages[-1]['content'] if messages else "")


async def _call_anthropic(
    messages: List[Dict[str, str]],
    system: str,
    max_tokens: int
) -> str:
    """Call Anthropic Claude API"""
    try:
        import anthropic
    except ImportError:
        raise Exception("anthropic package not installed")

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    # Convert messages to Anthropic format
    anthropic_messages = []
    for msg in messages:
        anthropic_messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })

    response = client.messages.create(
        model=settings.AI_MODEL if "claude" in settings.AI_MODEL else "claude-sonnet-4-20250514",
        max_tokens=max_tokens,
        system=system,
        messages=anthropic_messages
    )

    return response.content[0].text


async def _call_openai(
    messages: List[Dict[str, str]],
    system: str,
    max_tokens: int
) -> str:
    """Call OpenAI API"""
    try:
        import openai
    except ImportError:
        raise Exception("openai package not installed")

    client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)

    # Build messages with system prompt
    openai_messages = [{"role": "system", "content": system}]
    for msg in messages:
        openai_messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })

    model = settings.AI_MODEL if "gpt" in settings.AI_MODEL else "gpt-4o-mini"

    response = client.chat.completions.create(
        model=model,
        messages=openai_messages,
        max_tokens=max_tokens
    )

    return response.choices[0].message.content


def _get_fallback_response(user_message: str) -> str:
    """Provide canned responses when no AI provider is configured"""
    lower_msg = user_message.lower()

    responses = {
        "schedule": """Here's a suggested production schedule approach:

**Pre-Production** (2-4 weeks)
- [ ] Script breakdown and analysis
- [ ] Location scouting
- [ ] Casting and crew hiring
- [ ] Equipment planning

**Production** (varies by scope)
- [ ] Principal photography
- [ ] B-roll and inserts

**Post-Production** (4-8 weeks)
- [ ] Editing and assembly
- [ ] Color correction
- [ ] Sound design and mix
- [ ] VFX if needed

Would you like me to help break this down into specific tasks?""",

        "task": """Here are essential pre-production tasks:

**Week 1-2:**
- [ ] Complete script breakdown
- [ ] Create scene-by-scene shot list
- [ ] Begin location scouting
- [ ] Draft initial budget

**Week 3-4:**
- [ ] Finalize locations
- [ ] Hire key crew positions
- [ ] Equipment list and rental quotes
- [ ] Create call sheets""",

        "crew": """Essential crew positions for an indie production:

**Core Crew:**
- Director
- Director of Photography
- 1st Assistant Director
- Production Manager

**Camera Department:**
- Camera Operator
- 1st AC (Focus Puller)

**Sound:**
- Production Sound Mixer
- Boom Operator

**G&E:**
- Gaffer
- Key Grip""",

        "location": """**Location Scouting Checklist:**

**Technical:**
- [ ] Power availability
- [ ] Natural light assessment
- [ ] Sound environment
- [ ] Space for equipment

**Logistics:**
- [ ] Parking access
- [ ] Load-in routes
- [ ] Restroom facilities

**Legal:**
- [ ] Location release
- [ ] Permit requirements
- [ ] Insurance needs""",

        "call sheet": """**Essential Call Sheet Elements:**

**Header:**
- Production title and day #
- Date and weather
- Crew call times
- Location with parking

**Contacts:**
- Key crew phones
- Emergency contacts
- Nearest hospital

**Schedule:**
- Scene numbers
- Estimated times
- Meal breaks""",

        "budget": """**Budget Management Tips:**

1. **Track Everything** - Log all expenses in real-time
2. **10-15% Contingency** - For unexpected costs
3. **Prioritize** - Sound and camera show on screen
4. **Negotiate** - Multi-day discounts, package deals
5. **Network** - Crew-owned gear, location connections"""
    }

    # Check for keyword matches
    for keyword, response in responses.items():
        if keyword in lower_msg:
            return response

    # Default response
    return """I can help with production planning! Try asking about:

- **Scheduling** - Production timeline planning
- **Tasks** - Pre-production checklists
- **Crew** - Position recommendations
- **Locations** - Scouting checklists
- **Call Sheets** - Essential elements
- **Budget** - Cost management tips

What would you like help with?"""
