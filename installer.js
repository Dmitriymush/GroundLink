import inquirer from 'inquirer';
import { FEATURES } from './src/constants/features'

async function main() {
    const response = await inquirer.prompt([
        {
            type: 'checkbox',
            name: 'features',
            message: 'Select the features you want to install',
            choices: FEATURES.map(f => f.name)
        }
    ]);
};


main().catch(console.error);