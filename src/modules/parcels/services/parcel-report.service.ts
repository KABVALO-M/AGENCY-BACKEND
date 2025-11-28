import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import PDFDocument from 'pdfkit';
import { IsNull, Repository } from 'typeorm';
import * as turf from '@turf/turf';
import { PassThrough } from 'stream';
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
  private readonly logger = new Logger(ParcelReportService.name);

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

  /**
   * Returns the full PDF as a buffer (used by non-stream consumers).
   */
  async generateParcelReport(parcelId: string): Promise<Buffer> {
    const sections = await this.buildReportSections(parcelId);
    const pdfStream = this.buildPdfStream(sections);
    const chunks: Buffer[] = [];

    return new Promise<Buffer>((resolve, reject) => {
      pdfStream.on('data', (chunk) => chunks.push(chunk as Buffer));
      pdfStream.on('end', () => resolve(Buffer.concat(chunks)));
      pdfStream.on('error', (err) => reject(err));
    });
  }

  /**
   * Builds the PDF as a stream for immediate response piping.
   */
  async generateParcelReportStream(parcelId: string): Promise<{
    stream: PassThrough;
    filename: string;
  }> {
    const sections = await this.buildReportSections(parcelId);
    const stream = this.buildPdfStream(sections);
    return { stream, filename: `parcel-${parcelId}.pdf` };
  }

  private buildPdfStream(sections: ParcelReportSections): PassThrough {
    const doc = new PDFDocument({ margin: 40 });
    const stream = new PassThrough();
    doc.pipe(stream);
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

    if (mapImage && mapImage.length > 0) {
      try {
        doc.fontSize(14).text('Map Snapshot', { underline: true }).moveDown(0.5);
        doc.image(mapImage, {
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
          align: 'center',
        });
        doc.moveDown();
      } catch (error) {
        // If image format is invalid, skip the image but continue with the report
        this.logger.warn(
          `Failed to add map image to PDF for parcel ${sections.parcel.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        doc
          .fontSize(12)
          .text('Map snapshot unavailable')
          .moveDown();
      }
    }

    doc.fontSize(14).text('Risk Summary', { underline: true }).moveDown(0.5);

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

    return stream;
  }

  private async buildReportSections(
    parcelId: string,
  ): Promise<ParcelReportSections> {
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

    return {
      parcel,
      riskSummary,
      insights,
      facilities,
      mapImage,
    };
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

      // Check if response is actually an image
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        // Likely an error response (XML/HTML), not an image
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Validate buffer is not empty and appears to be a PNG/JPEG
      if (buffer.length === 0) {
        return null;
      }

      // Basic validation: Check for PNG or JPEG magic bytes
      const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
      const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

      if (!isPng && !isJpeg) {
        // Buffer doesn't contain a valid image, likely an error response
        this.logger.warn(
          `Invalid image format received from GeoServer for parcel ${parcel.id}. Expected PNG/JPEG, got buffer starting with: ${buffer.slice(0, 10).toString('hex')}`,
        );
        return null;
      }

      return buffer;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch map snapshot for parcel ${parcel.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }
}
