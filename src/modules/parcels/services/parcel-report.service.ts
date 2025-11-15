import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import PDFDocument from 'pdfkit';
import { IsNull, Repository } from 'typeorm';
import * as turf from '@turf/turf';
import { Parcel } from '../entities/parcel.entity';
import { PARCEL_MESSAGES } from '../messages/parcel.messages';
import { ParcelRiskSummaryView } from '../entities/parcel-risk-summary-view.entity';
import { ParcelLocationInsight } from '../entities/parcel-location-insight.entity';
import { ParcelFacility } from '../entities/parcel-facility.entity';
import { ConfigService } from '@nestjs/config';

interface ParcelReportSections {
  parcel: Parcel;
  riskSummary?: ParcelRiskSummaryView | null;
  insights: ParcelLocationInsight[];
  facilities: ParcelFacility[];
  mapImage?: Buffer | null;
}

@Injectable()
export class ParcelReportService {
  constructor(
    @InjectRepository(Parcel)
    private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(ParcelRiskSummaryView)
    private readonly riskSummaryRepository: Repository<ParcelRiskSummaryView>,
    @InjectRepository(ParcelLocationInsight)
    private readonly insightRepository: Repository<ParcelLocationInsight>,
    @InjectRepository(ParcelFacility)
    private readonly facilityRepository: Repository<ParcelFacility>,
    private readonly configService: ConfigService,
  ) {}

  async generateParcelReport(parcelId: string): Promise<Buffer> {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId, deletedAt: IsNull() },
      relations: ['createdBy', 'owner'],
    });

    if (!parcel) {
      throw new NotFoundException(PARCEL_MESSAGES.NOT_FOUND);
    }

    const [riskSummary, insights, facilities, mapImage] = await Promise.all([
      this.riskSummaryRepository.findOne({ where: { parcelId } }),
      this.insightRepository.find({
        where: { parcel: { id: parcelId } },
        order: { createdAt: 'DESC' },
        take: 5,
      }),
      this.facilityRepository.find({
        where: { parcel: { id: parcelId } },
        order: { importanceScore: 'DESC' },
        take: 5,
      }),
      this.fetchMapSnapshot(parcel),
    ]);

    return this.buildPdf({
      parcel,
      riskSummary,
      insights,
      facilities,
      mapImage,
    });
  }

  private async buildPdf(sections: ParcelReportSections): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    const { parcel, riskSummary, insights, facilities, mapImage } = sections;

    doc
      .fontSize(20)
      .text(`Parcel Report: ${parcel.name}`, { align: 'left' })
      .moveDown(0.5);

    doc
      .fontSize(12)
      .text(`Title Number: ${parcel.titleNumber ?? 'N/A'}`)
      .text(`Status: ${parcel.status}`)
      .text(
        `Owner: ${
          parcel.owner
            ? `${parcel.owner.firstName} ${parcel.owner.lastName}`
            : 'Unassigned'
        }`,
      )
      .text(
        `Created By: ${
          parcel.createdBy
            ? `${parcel.createdBy.firstName} ${parcel.createdBy.lastName}`
            : 'System'
        }`,
      )
      .moveDown();

    if (mapImage) {
      doc
        .fontSize(14)
        .text('Map Snapshot', { underline: true })
        .moveDown(0.5);
      doc.image(mapImage, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: 'center',
      });
      doc.moveDown();
    }

    doc
      .fontSize(14)
      .text('Risk Summary', { underline: true })
      .moveDown(0.5);

    if (riskSummary) {
      doc
        .fontSize(12)
        .text(`Overall Score: ${riskSummary.overallScore ?? 'N/A'}`)
        .text(`Risk Band: ${riskSummary.riskBand ?? 'N/A'}`)
        .text(
          `Population: ${
            riskSummary.population ?? 'N/A'
          } (Density: ${riskSummary.densityPerSqKm ?? 'N/A'} / km²)`,
        )
        .text(
          `Facilities Nearby: ${
            riskSummary.facilityCount ?? 0
          } (Avg Score: ${riskSummary.avgFacilityScore ?? 'N/A'})`,
        )
        .moveDown(0.5);

      if (riskSummary.drivers) {
        doc.fontSize(11).text('Risk Drivers:', { underline: true });
        Object.entries(riskSummary.drivers).forEach(([key, value]) => {
          doc.text(`• ${key}: ${value as string}`);
        });
        doc.moveDown();
      }
    } else {
      doc.text('No risk assessment recorded.').moveDown();
    }

    doc.fontSize(14).text('Key Insights', { underline: true }).moveDown(0.5);
    if (insights.length) {
      insights.forEach((insight) => {
        doc
          .fontSize(12)
          .text(`• ${insight.title} (${insight.category})`)
          .fontSize(10)
          .text(insight.description ?? 'No description provided.')
          .moveDown(0.3);
      });
      doc.moveDown();
    } else {
      doc.fontSize(12).text('No insights recorded.').moveDown();
    }

    doc.fontSize(14).text('Nearby Facilities', { underline: true }).moveDown();
    if (facilities.length) {
      facilities.forEach((facility) => {
        doc
          .fontSize(12)
          .text(
            `• ${facility.name} (${facility.facilityType}) - ${facility.distanceMeters ?? 'N/A'} m away`,
          )
          .fontSize(10)
          .text(facility.description ?? 'No description provided.')
          .moveDown(0.3);
      });
    } else {
      doc.fontSize(12).text('No facility records.').moveDown();
    }

    doc.end();

    return new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  private async fetchMapSnapshot(parcel: Parcel): Promise<Buffer | null> {
    const baseUrl =
      this.configService.get<string>('GEOSERVER_BASE_URL') ??
      'http://localhost:8080/geoserver';
    const workspace =
      this.configService.get<string>('GEOSERVER_WORKSPACE') ?? 'terracore';
    const layer = `${workspace}:parcels`;

    try {
      const bbox = turf.bbox(parcel.geometry);
      const url = new URL(`${baseUrl.replace(/\/$/, '')}/${workspace}/ows`);
      url.searchParams.set('service', 'WMS');
      url.searchParams.set('version', '1.1.1');
      url.searchParams.set('request', 'GetMap');
      url.searchParams.set('layers', layer);
      url.searchParams.set('bbox', bbox.join(','));
      url.searchParams.set('width', '800');
      url.searchParams.set('height', '600');
      url.searchParams.set('srs', 'EPSG:4326');
      url.searchParams.set('format', 'image/png');
      url.searchParams.set('cql_filter', `id='${parcel.id}'`);

      const response = await fetch(url.toString());
      if (!response.ok) {
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      return null;
    }
  }
}
