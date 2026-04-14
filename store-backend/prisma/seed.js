"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield prisma.version.deleteMany({});
        yield prisma.extension.deleteMany({});
        const extensions = [
            {
                name: 'FastAES',
                slug: 'fastaes',
                description: 'High-performance AES encryption for XSil processors.',
                shortDescription: 'Accelerated AES-256 encryption/decryption.',
                author: 'CryptoSoft',
                category: 'Crypto',
                tags: 'aes,crypto,encryption,fast',
                iconUrl: '/icons/crypto.svg',
                rating: 4.8,
                downloads: 15000,
                versions: {
                    create: [
                        {
                            version: '1.0.0',
                            changelog: 'Initial release',
                            xsilUrl: 'https://registry.extensilica.com/fastaes/-/fastaes-1.0.0.xsil',
                        },
                    ],
                },
            },
            {
                name: 'MLBoost',
                slug: 'mlboost',
                description: 'Optimized machine learning inference engine for edge devices.',
                shortDescription: 'Run ML models faster on low-power hardware.',
                author: 'AI Labs',
                category: 'ML',
                tags: 'ml,ai,inference,edge',
                iconUrl: '/icons/ml.svg',
                rating: 4.5,
                downloads: 23000,
                versions: {
                    create: [
                        {
                            version: '2.1.0',
                            changelog: 'Added support for Transformer models',
                            xsilUrl: 'https://registry.extensilica.com/mlboost/-/mlboost-2.1.0.xsil',
                        },
                    ],
                },
            },
            {
                name: 'DSPFilter',
                slug: 'dspfilter',
                description: 'Advanced digital signal processing filters including FIR and IIR.',
                shortDescription: 'Professional grade digital signal filters.',
                author: 'SignalMasters',
                category: 'DSP',
                tags: 'dsp,filter,audio,signal',
                iconUrl: '/icons/dsp.svg',
                rating: 4.7,
                downloads: 8900,
                versions: {
                    create: [
                        {
                            version: '3.0.1',
                            changelog: 'Fixed memory leak in FIR implementation',
                            xsilUrl: 'https://registry.extensilica.com/dspfilter/-/dspfilter-3.0.1.xsil',
                        },
                    ],
                },
            },
            {
                name: 'Robotics Motion',
                slug: 'robotics-motion',
                description: 'Kinematics and path planning library for 6-DOF robotic arms.',
                shortDescription: 'Precise motion control for robotic arms.',
                author: 'RoboTech',
                category: 'Robotics',
                tags: 'robotics,motion,kinematics,control',
                iconUrl: '/icons/robotics.svg',
                rating: 4.2,
                downloads: 5600,
                versions: {
                    create: [
                        {
                            version: '0.5.0',
                            changelog: 'Beta release with inverse kinematics',
                            xsilUrl: 'https://registry.extensilica.com/robotics-motion/-/robotics-motion-0.5.0.xsil',
                        },
                    ],
                },
            },
            {
                name: 'CryptoLight',
                slug: 'cryptolight',
                description: 'Lightweight cryptography library optimized for IoT sensors.',
                shortDescription: 'Secure your IoT devices with minimal overhead.',
                author: 'SecureThings',
                category: 'Crypto',
                tags: 'crypto,iot,lightweight,security',
                iconUrl: '/icons/crypto.svg',
                rating: 4.0,
                downloads: 1200,
                versions: {
                    create: [
                        {
                            version: '1.1.2',
                            changelog: 'Performance improvements for ARM Cortex-M',
                            xsilUrl: 'https://registry.extensilica.com/cryptolight/-/cryptolight-1.1.2.xsil',
                        },
                    ],
                },
            },
        ];
        for (const ext of extensions) {
            const extension = yield prisma.extension.create({
                data: ext,
            });
            console.log({ extension });
        }
    });
}
main()
    .then(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}))
    .catch((e) => __awaiter(void 0, void 0, void 0, function* () {
    console.error(e);
    yield prisma.$disconnect();
    process.exit(1);
}));
