import { Worker } from '@temporalio/worker';
import { ContentGenerationWorkflow } from './content-generation.workflow';
import { ContentGenerationActivitiesImpl } from './activities';

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('./content-generation.workflow'),
    activities: new ContentGenerationActivitiesImpl(),
    taskQueue: 'content-generation',
  });

  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
}); 