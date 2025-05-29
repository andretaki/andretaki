#!/usr/bin/env node

import { Command } from 'commander';
import { runInnovatorAgent } from '../lib/agents/innovator-agent';
import { pipelineCommand } from './commands/pipeline';
import { syncCommand } from './commands/sync';

const program = new Command();

program
  .name('chemflow-cli')
  .description('ChemFlow Marketing CLI - AI-powered chemical marketing automation')
  .version('1.0.0');

program
  .command('innovate')
  .description('Run Innovator Agent to generate blog ideas based on enriched product applications or a general theme')
  .option('-t, --focusType <type>', "Focus type: 'enriched_product_id' | 'general_theme'", 'general_theme')
  .option('-v, --focusValue <value>', "Focus value (Enriched Product ID for 'enriched_product_id', or theme string for 'general_theme')", 'Sustainable chemistry practices')
  .option('-a, --audience <audience>', "Target audience", 'R&D Chemists and Process Engineers')
  .option('-n, --numIdeasPerApplication <number>', "Number of ideas per application (if product focused)", (value) => parseInt(value, 10), 2)
  .action(async (options) => {
    if (options.focusType === 'enriched_product_id' && isNaN(parseInt(options.focusValue))) {
        console.error("Error: For focusType 'enriched_product_id', focusValue must be a numeric ID.");
        return;
    }
    console.log('Running Innovator Agent with options:', options);
    try {
      const result = await runInnovatorAgent({
          focusType: options.focusType as 'enriched_product_id' | 'general_theme',
          focusValue: options.focusValue,
          targetAudience: options.audience,
          numIdeasPerApplication: options.numIdeasPerApplication
      });
      console.log('Innovator Agent Result:', result);
    } catch (error) {
      console.error('Error running Innovator Agent:', error);
      process.exit(1);
    }
  });

// Add the comprehensive sync command
program.addCommand(syncCommand);

program
  .command('generate')
  .description('Generate content using AI agents')
  .option('-t, --type <type>', 'Content type (blog_outline, blog_content, video_script, ad_copy)', 'blog_outline')
  .option('-i, --input <input>', 'Input source (pipeline task ID or product ID)')
  .action(async (options) => {
    console.log('Running content generation with options:', options);
    console.log('Note: Content generation functionality not yet implemented');
  });

// Add the comprehensive pipeline command
program.addCommand(pipelineCommand);

program
  .command('config')
  .description('Manage agent configurations')
  .option('-a, --action <action>', 'Action (list, get, set)', 'list')
  .option('-n, --name <name>', 'Agent name')
  .option('-p, --parameter <parameter>', 'Parameter to get/set')
  .option('-v, --value <value>', 'Value to set')
  .action(async (options) => {
    console.log('Managing configuration with options:', options);
    console.log('Note: Configuration management functionality not yet implemented');
  });

// Error handling
program.configureHelp({
  sortSubcommands: true,
  subcommandTerm: (cmd) => cmd.name() + ' ' + cmd.usage()
});

program.parse(); 