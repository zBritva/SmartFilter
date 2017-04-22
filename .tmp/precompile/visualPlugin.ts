module powerbi.visuals.plugins {
    export var SmartFilterBySQLBI1458262140625 = {
        name: 'SmartFilterBySQLBI1458262140625',
        displayName: 'Smart Filter by OKViz',
        class: 'Visual',
        version: '1.1.1',
        apiVersion: '1.5.0',
        create: (options: extensibility.visual.VisualConstructorOptions) => new powerbi.extensibility.visual.SmartFilterBySQLBI1458262140625.Visual(options),
        custom: true
    };
}
