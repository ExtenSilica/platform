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
        const packages = [
            {
                name: 'FastAES',
                slug: 'fastaes',
                description: 'High-performance AES-256 acceleration extension for RISC-V processors.',
                shortDescription: 'AES-256 hardware acceleration for RISC-V.',
                author: 'xsil-community',
                keywords: 'aes,encryption,security,riscv',
                versions: {
                    create: [
                        {
                            version: '1.0.0',
                            changelog: 'Initial release',
                            xsilUrl: 'https://registry.extensilica.com/fastaes/-/fastaes-1.0.0.xsil',
                            isa: 'rv64gc',
                        },
                        {
                            version: '1.0.7',
                            changelog: 'Performance improvements; reduced cycle count by 18%',
                            xsilUrl: 'https://registry.extensilica.com/fastaes/-/fastaes-1.0.7.xsil',
                            isa: 'rv64gc',
                        },
                    ],
                },
            },
            {
                name: 'MLBoost',
                slug: 'mlboost',
                description: 'Optimised matrix-multiply and activation extensions for RISC-V ML inference.',
                shortDescription: 'ML inference acceleration on RISC-V.',
                author: 'ai-labs',
                keywords: 'ml,ai,inference,matrix,riscv',
                versions: {
                    create: [
                        {
                            version: '2.1.0',
                            changelog: 'Added support for transformer attention kernels',
                            xsilUrl: 'https://registry.extensilica.com/mlboost/-/mlboost-2.1.0.xsil',
                            isa: 'rv64gcv',
                        },
                    ],
                },
            },
            {
                name: 'DSPFilter',
                slug: 'dspfilter',
                description: 'Advanced FIR and IIR digital signal processing filters for RISC-V.',
                shortDescription: 'FIR/IIR DSP filters for RISC-V.',
                author: 'signal-masters',
                keywords: 'dsp,filter,audio,signal,riscv',
                versions: {
                    create: [
                        {
                            version: '3.0.1',
                            changelog: 'Fixed memory alignment bug in FIR implementation',
                            xsilUrl: 'https://registry.extensilica.com/dspfilter/-/dspfilter-3.0.1.xsil',
                            isa: 'rv32imc',
                        },
                    ],
                },
            },
            {
                name: 'RVX Demo',
                slug: 'rvx-demo',
                description: 'Minimal demonstration package: a RISC-V program that runs under Spike.',
                shortDescription: 'Hello-world .xsil package for RISC-V.',
                author: 'extensilica',
                keywords: 'demo,tutorial,spike,riscv',
                versions: {
                    create: [
                        {
                            version: '1.0.0',
                            changelog: 'Initial demo package',
                            xsilUrl: 'https://registry.extensilica.com/rvx-demo/-/rvx-demo-1.0.0.xsil',
                            isa: 'rv64gc',
                            targets: JSON.stringify({ spike: {} }),
                        },
                    ],
                },
            },
            {
                name: 'Vec128',
                slug: 'vec128',
                description: 'RISC-V Vector (RVV 1.0) extension package with 128-bit VLEN examples and tests.',
                shortDescription: 'RVV 1.0 vector extension examples.',
                author: 'rvv-contributors',
                keywords: 'vector,rvv,simd,riscv',
                versions: {
                    create: [
                        {
                            version: '0.9.0',
                            changelog: 'Beta release; covers vadd, vmul, and reduction operations',
                            xsilUrl: 'https://registry.extensilica.com/vec128/-/vec128-0.9.0.xsil',
                            isa: 'rv64gcv',
                        },
                    ],
                },
            },
        ];
        for (const pkg of packages) {
            const created = yield prisma.extension.create({ data: pkg });
            console.log(`Created: ${created.slug}`);
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
