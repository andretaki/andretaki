-- Migration file: 001_create_agent_configurations.sql

CREATE TABLE marketing.agent_configurations (
    id SERIAL PRIMARY KEY,
    agent_type VARCHAR(100) NOT NULL UNIQUE,
    llm_model_name VARCHAR(100) NOT NULL,
    base_prompt TEXT NOT NULL,
    default_parameters JSONB,
    output_parser_type VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE marketing.agent_configurations OWNER TO "default"; 